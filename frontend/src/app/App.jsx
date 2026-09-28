import { MotionConfig } from 'motion/react'
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration, useLocation } from 'react-router'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { ToastProvider } from './components/ui/overlay'
import { LogoMark } from './components/ui/Logo'
import PublicLayout from './layouts/PublicLayout'
import Landing from './pages/public/Landing'
import { ROLE_HOME } from './services/authService'

// Route-level code splitting: a guest never downloads the admin consoles.
const Login = lazy(() => import('./pages/auth/Login'))
const Legal = lazy(() => import('./pages/public/Legal'))
const NotFound = lazy(() => import('./pages/public/NotFound'))

const UserLayout = lazy(() => import('./layouts/UserLayout'))
const UserEvents = lazy(() => import('./pages/user/Events'))
const EventDetail = lazy(() => import('./pages/user/EventDetail'))
const Search = lazy(() => import('./pages/user/Search'))
const Results = lazy(() => import('./pages/user/Results'))
const PhotoViewer = lazy(() => import('./pages/user/PhotoViewer'))
const Profile = lazy(() => import('./pages/user/Profile'))

const ConsoleLayout = lazy(() => import('./layouts/ConsoleLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminEvents = lazy(() => import('./pages/admin/Events'))
const EventForm = lazy(() => import('./pages/admin/EventForm'))
const AdminEventDetail = lazy(() => import('./pages/admin/EventDetail'))
const AssignAdmins = lazy(() => import('./pages/admin/AssignAdmins'))
const AdminUsers = lazy(() => import('./pages/admin/Users'))
const AdminAnalytics = lazy(() => import('./pages/admin/Analytics'))
const AdminVisitors = lazy(() => import('./pages/admin/Visitors'))
const Settings = lazy(() => import('./pages/shared/Settings'))

const EADashboard = lazy(() => import('./pages/eventAdmin/Dashboard'))
const EAEvents = lazy(() => import('./pages/eventAdmin/Events'))
const EAEventDashboard = lazy(() => import('./pages/eventAdmin/EventDashboard'))
const EAPhotos = lazy(() => import('./pages/eventAdmin/Photos'))
const EAEventSettings = lazy(() => import('./pages/eventAdmin/EventSettings'))
const EAEventAnalytics = lazy(() => import('./pages/eventAdmin/EventAnalytics'))
const EAPickEvent = lazy(() => import('./pages/eventAdmin/PickEvent'))
const EAAnalytics = lazy(() => import('./pages/eventAdmin/Analytics'))

// The original, working Genesis Hub tool (browser photo library + real AI search).
const Lab = lazy(() => import('../facefetch/LabApp'))

function PageFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center" role="status" aria-label="Loading">
      <LogoMark size={40} className="animate-pulse" />
    </div>
  )
}

function Root() {
  return (
    <>
      <ScrollRestoration getKey={(loc) => loc.pathname} />
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </>
  )
}

function RequireRole({ roles }) {
  const { user } = useAuth()
  const loc = useLocation()
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  if (!roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />
  return <Outlet />
}

function GuestOnly() {
  const { user } = useAuth()
  const next = new URLSearchParams(useLocation().search).get('next')
  if (user) return <Navigate to={next || ROLE_HOME[user.role]} replace />
  return <Outlet />
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: '/', element: <Landing /> },
          { path: '/privacy', element: <Legal doc="privacy" /> },
          { path: '/terms', element: <Legal doc="terms" /> },
          { path: '/consent', element: <Legal doc="consent" /> },
        ],
      },
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', element: <Login /> },
        ],
      },
      // Finding your photos needs no account: pick an event, take a selfie
      // (or upload one) and see every photo you're in.
      {
        element: <UserLayout />,
        children: [
          { path: '/events', element: <UserEvents /> },
          { path: '/events/:eventId', element: <EventDetail /> },
          { path: '/events/:eventId/results', element: <Results /> },
        ],
      },
      { path: '/events/:eventId/search', element: <Search /> },
      { path: '/events/:eventId/photo/:photoId', element: <PhotoViewer /> },
      {
        element: <RequireRole roles={['end_user']} />,
        children: [
          {
            element: <UserLayout />,
            children: [
              { path: '/profile', element: <Profile /> },
              { path: '/my-photos', element: <Profile tab="photos" /> },
              { path: '/favorites', element: <Profile tab="favorites" /> },
              { path: '/account', element: <Profile tab="account" /> },
            ],
          },
        ],
      },
      {
        path: '/admin',
        element: <RequireRole roles={['super_admin']} />,
        children: [
          {
            element: <ConsoleLayout role="super_admin" />,
            children: [
              { index: true, element: <AdminDashboard /> },
              { path: 'events', element: <AdminEvents /> },
              { path: 'events/create', element: <EventForm /> },
              { path: 'events/:eventId', element: <AdminEventDetail /> },
              { path: 'events/:eventId/edit', element: <EventForm /> },
              { path: 'events/:eventId/admins', element: <AssignAdmins /> },
              { path: 'admins', element: <AdminUsers tab="admins" /> },
              { path: 'users', element: <AdminUsers tab="guests" /> },
              { path: 'visitors', element: <AdminVisitors /> },
              { path: 'analytics', element: <AdminAnalytics /> },
              { path: 'settings', element: <Settings /> },
            ],
          },
        ],
      },
      {
        path: '/event-admin',
        element: <RequireRole roles={['event_admin']} />,
        children: [
          {
            element: <ConsoleLayout role="event_admin" />,
            children: [
              { index: true, element: <EADashboard /> },
              { path: 'events', element: <EAEvents /> },
              { path: 'events/create', element: <EventForm base="/event-admin" /> },
              { path: 'events/:eventId', element: <EAEventDashboard /> },
              { path: 'events/:eventId/photos', element: <EAPhotos /> },
              { path: 'events/:eventId/settings', element: <EAEventSettings /> },
              { path: 'events/:eventId/analytics', element: <EAEventAnalytics /> },
              { path: 'photos', element: <EAPickEvent /> },
              { path: 'analytics', element: <EAAnalytics /> },
              { path: 'settings', element: <Settings /> },
            ],
          },
        ],
      },
      { path: '/lab', element: <Lab /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </MotionConfig>
  )
}
