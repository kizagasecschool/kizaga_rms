import ErrorBoundary from '../../components/ErrorBoundary'
import AcademicResults from '../academic/Results'

export default function HeadmasterResults() {
  return (
    <ErrorBoundary>
      <AcademicResults />
    </ErrorBoundary>
  )
}
