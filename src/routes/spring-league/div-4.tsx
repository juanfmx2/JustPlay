import { createFileRoute } from '@tanstack/react-router'
import { SpringLeagueDivisionPage } from '../../components/SpringLeagueDivisionPage'

export const Route = createFileRoute('/spring-league/div-4')({
  component: DivisionFourPage,
})

function DivisionFourPage() {
  return (
    <SpringLeagueDivisionPage
      divisionName="Division 4"
      dayAndLocation="Fridays at The Perse"
      teamStart={13}
    />
  )
}
