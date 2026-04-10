import { createFileRoute } from '@tanstack/react-router'
import { SpringLeagueDivisionPage } from '../../components/SpringLeagueDivisionPage'

export const Route = createFileRoute('/spring-league/div-3')({
  component: DivisionThreePage,
})

function DivisionThreePage() {
  return (
    <SpringLeagueDivisionPage
      divisionName="Division 3"
      dayAndLocation="Fridays at The Perse"
      teamStart={9}
    />
  )
}
