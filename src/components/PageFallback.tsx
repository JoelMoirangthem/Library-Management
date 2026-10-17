import { LoadingState } from '@/components/states/LoadingState'

/** Shown inside a layout while a page's code loads, so the header and navigation never disappear. */
export function PageFallback() {
  return <LoadingState label="Loading page" />
}
