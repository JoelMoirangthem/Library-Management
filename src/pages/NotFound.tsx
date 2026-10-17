import { Link } from 'react-router-dom'
import { buttonStyles } from '@/components/Button'
import { NotFoundState } from '@/components/states/NotFoundState'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <NotFoundState
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
