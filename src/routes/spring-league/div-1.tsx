import { createFileRoute } from '@tanstack/react-router'
import { SpringLeagueDivisionPage } from '../../components/SpringLeagueDivisionPage'

export const Route = createFileRoute('/spring-league/div-1')({
  component: DivisionOnePage,
})

function DivisionOnePage() {
  return (
    <SpringLeagueDivisionPage
      divisionName="Division 1"
      dayAndLocation="Thursdays at NCA"
      teamStart={1}
    />
  )
}
