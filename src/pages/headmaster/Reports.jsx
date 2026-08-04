import ErrorBoundary from '../../components/ErrorBoundary'
import StudentReports from '../academic/StudentReports'

export default function HeadmasterReports() {
  return (
    <ErrorBoundary>
      <StudentReports />
    </ErrorBoundary>
  )
}
