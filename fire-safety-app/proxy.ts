import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isLoginPage = pathname === '/login'
  const isRootPage = pathname === '/'
  const isProtectedRoute = 
    pathname.startsWith('/dashboard') || 
    pathname.startsWith('/admin') || 
    pathname.startsWith('/input')

  // 1. ถ้าเข้าหน้าแรก (Root) แล้วล็อกอินอยู่ ให้ส่งไป Dashboard ทันที
  if (isRootPage && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 2. ถ้าเข้าหน้าแรก (Root) แล้วยังไม่ล็อกอิน ให้ส่งไป Login
  if (isRootPage && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 3. ถ้าล็อกอินแล้ว แต่พยายามจะเข้าหน้า Login อีก ให้ส่งไป Dashboard
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 4. ถ้าจะเข้าหน้าสำคัญแต่ยังไม่ล็อกอิน ให้ส่งไป Login
  if (!user && isProtectedRoute) {
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return response
}