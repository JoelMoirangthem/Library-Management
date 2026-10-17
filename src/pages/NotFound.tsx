import { Link } from 'react-router-dom'
import { buttonStyles } from '@/components/Button'
import { NotFoundState } from '@/components/states/NotFoundState'
import { useTitle } from '@/hooks/useTitle'

export default function NotFound() {
  useTitle('Page not found')
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <NotFoundState
        heading="h1"
        title="Page not found"
        description="This address doesn't lead anywhere. It may have moved, or the link is wrong."
        action={
          <>
            <Link to="/" className={buttonStyles('primary')}>Go to home</Link>
            <Link to="/discover" className={buttonStyles('secondary')}>Find a library</Link>
          </>
        }
      />
    </div>
  )
}
