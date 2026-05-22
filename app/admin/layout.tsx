import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Legacy admin routes — all admin functionality moved to /polla/[slug]/admin/
  redirect('/')
}
