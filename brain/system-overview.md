# System Overview
This document provides a high-level overview of the entire Rent Anything / Easy Rent system. Claude must read and understand this file before writing or modifying any code. It defines the architecture, stack, and core principles that guide all implementation decisions.

---

## Purpose
The goal is to build a browser-first rental marketplace where users can list items, request bookings, communicate, and leave reviews. The system must be secure, scalable, and easy to extend. Supabase provides the backend, Vercel hosts the frontend, and Claude writes all application code.

---

## Technology Stack

### **Frontend**
- **Next.js (App Router)**
  - React-based UI
  - Server Components where appropriate
  - Client Components for interactive features
  - API routes for backend logic
  - Deployed on Vercel

### **Backend**
- **Supabase (Postgres + Auth + Storage + RLS + Realtime)**
  - Database schema
  - Row Level Security policies
  - Auth (email, phone, OAuth)
  - Storage for images and files
  - Realtime subscriptions
  - SQL migrations

### **Hosting**
- **Vercel**
  - Production hosting
  - Preview deployments
  - Serverless API routes
  - Environment variable management

### **Development**
- **Claude**
  - Reads all `/brain/*.md` files before coding
  - Writes and modifies Next.js code
  - Implements Supabase queries
  - Follows architecture and rules exactly
  - Updates documentation when needed

---

## Core System Concepts

### **Listings**
Users can post items available for rent. Listings include:
- Title
- Description
- Price per day
- Images
- Location
- Owner
- Availability

### **Bookings**
Users request to rent items. Owners approve or reject.
Bookings include:
- Listing
- Renter
- Date range
- Status
- Total price

### **Messaging**
Renter and owner can communicate inside a booking thread.

### **Reviews**
After a completed booking, renters can leave a review.

---

## High-Level Architecture Flow

### **1. User Authentication**
Supabase handles:
- Sign up
- Login
- Session management
- JWTs
- RLS enforcement

### **2. Data Access**
All data access goes through:
- Supabase client (frontend)
- Supabase SQL policies (backend)
- Next.js API routes (optional)

### **3. Frontend Rendering**
Next.js renders:
- Server Components for data fetching
- Client Components for interaction
- Pages for listings, bookings, messages, profiles

### **4. Storage**
Supabase Storage holds:
- Listing images
- User avatars
- Attachments

### **5. Realtime**
Realtime is used for:
- Messaging
- Booking status updates

### **6. Deployment**
Vercel deploys automatically from GitHub.

---

## System Principles

### **1. Documentation First**
All architecture decisions must be documented in `/brain` before Claude writes code.

### **2. RLS-Driven Security**
Supabase Row Level Security is the foundation of all access control.

### **3. Predictable Data Models**
Tables must be simple, relational, and well-indexed.

### **4. Minimal API Routes**
Use Supabase client directly when possible.
Use Next.js API routes only when necessary.

### **5. Consistency**
Claude must follow naming conventions, patterns, and flows defined in `/brain`.

---

## Next Steps
Claude should wait for additional `.md` files before coding.
The next files will define:
- Database schema
- Relationships
- RLS policies
- API specifications
- Frontend structure
- Feature flows
