import { redirect } from 'next/navigation'

export default async function PollaHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/polla/${slug}/predictions`)
}
