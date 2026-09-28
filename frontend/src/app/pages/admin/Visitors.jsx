import VisitorsTable from '../../components/VisitorsTable'
import { PageHeader } from '../../components/ui/primitives'
import { useDocumentTitle } from '../../lib/hooks'

export default function AdminVisitors() {
  useDocumentTitle('Visitors')
  return (
    <div className="grid gap-6">
      <PageHeader title="Visitors" description="Everyone who searched for their photos, with the name and email they gave before their selfie." />
      <VisitorsTable />
    </div>
  )
}
