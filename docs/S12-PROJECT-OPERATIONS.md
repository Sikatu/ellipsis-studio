# ELLIPSIS Studio S12 — Project Operations

## Mission

Turn ELLIPSIS Studio into the operational system for managing client projects from intake through delivery.

S12 connects the existing Clients, Brand Discovery, and Invoice systems through a general-purpose project layer.

## Existing systems

- Studio Home
- Clients
- Brand Discovery
- Invoice Generator
- Invoice email delivery and reminders
- Secure invoice portal
- Supabase-backed admin authentication

## S12 scope

### S12.1 Project Foundation

Create the general project data model.

A project belongs to a client and may contain:

- title
- project type
- description
- status
- priority
- start date
- target completion date
- completed date
- progress
- budget
- currency
- internal notes
- archived state

Existing Brand Discovery projects remain intact and may later be linked to a studio project.

### S12.2 Project Workspace

Create:

- /admin/projects
- /admin/projects/new
- /admin/projects/[projectId]

The project workspace should expose:

- client
- project status
- project progress
- timeline
- financial summary
- linked invoices
- tasks
- milestones
- deliverables
- recent activity

### S12.3 Tasks and Milestones

Projects support:

- tasks
- priorities
- due dates
- completion
- ordering
- milestones
- milestone completion

### S12.4 Deliverables and Approvals

Projects support tracked deliverables including:

- file or external URL
- deliverable type
- version
- review status
- approval status
- approved timestamp
- delivery timestamp

### S12.5 Activity Timeline

Maintain an append-oriented project activity history for significant events such as:

- project creation
- status changes
- task completion
- milestone completion
- deliverable updates
- approvals
- invoice linkage
- notes

### S12.6 Studio Dashboard

Upgrade Studio Home to surface operational information:

- active projects
- projects needing attention
- overdue tasks
- upcoming deadlines
- outstanding invoices
- recent project activity

### S12.7 Client Intelligence

The Clients workspace becomes the complete client relationship view with:

- studio projects
- Brand Discovery projects
- invoices
- deliverables
- activity history

### S12.8 Production Hardening

Before merge:

- validate RLS
- validate service-role boundaries
- validate admin authorization
- add release audit
- run lint
- run production build
- verify Preview
- verify Production

## Non-goals

S12 does not replace the existing Brand Discovery workflow.

S12 does not redesign the Invoice subsystem.

S12 does not modify the separate moodboard worktree unless explicitly planned.

## Release principle

Implement S12 incrementally.

Each subphase must be independently testable before proceeding to the next.
