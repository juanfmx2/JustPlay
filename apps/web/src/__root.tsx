import React from 'react'
import { createRootRoute, RootRoute } from '@tanstack/react-router'
import App from './App'

const RootComponent = () => <App />

export const Route: RootRoute = createRootRoute({
  component: RootComponent,
})
