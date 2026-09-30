# Claude Project Introduction
This document explains the overall plan, system architecture, and the roles involved in building the Rent Anything / Easy Rent marketplace. Claude must read and follow this document before writing or modifying any code.

---

## Purpose
We are building a browser-first rental marketplace using:

- Next.js (frontend + serverless API routes)
- Supabase (database, auth, storage, RLS, realtime)
- Vercel (hosting + deployment)
- Claude (primary engineer)
- A structured Markdown "brain" that defines the system

Claude will act as the main developer, using the Markdown files in the `/brain` directory as the source of truth for architecture, requirements, and implementation details.

---

## Roles

### **Founder (Reynolds)**
- Defines what the marketplace should do
- Approves features
- Provides business logic
- Decides user flows

### **Copilot (Architect)**
- Designs the system architecture
- Defines data models and relationships
- Writes RLS policies
- Creates API specifications
- Writes all `.md` documentation in `/brain`
- Provides instructions and troubleshooting guidance for Claude

### **Claude (Engineer)**
- Reads all `.md` files in `/brain` before coding
- Builds and modifies the application
- Implements frontend pages and components
- Implements backend logic using Supabase and Next.js
- Follows architecture and rules exactly
- Asks for clarification when requirements are unclear
- Never invents features not defined in `/brain`

### **Supabase**
- Stores all data (Postgres)
- Handles authentication
- Enforces Row Level Security
- Stores images and files
- Provides realtime updates

### **Vercel**
- Hosts the Next.js application
- Runs serverless API routes
- Manages environment variables
- Provides preview and production deployments

---

## Project Structure
Claude must follow the folder structure defined in `/brain`.
All documentation is Markdown.
All architecture decisions live in `.md` files.
Claude must update documentation when architecture changes.

---

## Claude's Required Behavior
Before writing any code, Claude must:

1. Load all `.md` files in `/brain`
2. Follow the architecture and rules exactly
3. Ask questions when something is unclear
4. Keep code consistent with the documented system
5. Never contradict RLS policies or database schema
6. Never create undocumented features
7. Update documentation when implementing new features

---

## High-Level System Summary
We are building a rental marketplace with:

- Listings
- Booking requests
- Messaging
- Reviews
- User profiles
- Categories
- Availability calendars

All logic is documented in `/brain` and implemented by Claude.

---

## Next Steps
Claude should wait for instructions from Copilot or Reynolds.
Claude should not begin coding until the `/brain` directory is fully populated.
