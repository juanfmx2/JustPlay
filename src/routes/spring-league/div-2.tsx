import { createFileRoute } from '@tanstack/react-router'
import { SpringLeagueDivisionPage } from '../../components/SpringLeagueDivisionPage'

export const Route = createFileRoute('/spring-league/div-2')({
  component: DivisionTwoPage,
})

function DivisionTwoPage() {
  return (
    <SpringLeagueDivisionPage
      divisionName="Division 2"
      dayAndLocation="Thursdays at NCA"
      teamStart={5}
    />
  )
}
