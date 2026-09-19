# RedLine 

> **Challenge SC-12: District Blood Donor Matching** (Track 3 / Public Welfare)
> 
> 
> A privacy-preserving emergency blood triage and dispatch platform connecting hospitals with interval-eligible voluntary donors across Kerala.
> 
> 

---

## Overview

Emergency blood requests shared through broadcast groups often reach the wrong audiences, spam recently donated individuals, and leak voluntary donors' phone numbers permanently on public platforms.

**RedLine** automates emergency triage by matching patients with nearby donors based on:

1. **Biological Compatibility** (Red blood cell matching rules, e.g., $O^-$ and $O^+$ for an $O^+$ recipient)
2. **Mandatory 90-Day Donation Recovery Intervals**

3. **District-Level Regional Availability** (across all 14 districts of Kerala)


4. **Zero-Knowledge Donor Privacy**: Phone numbers remain masked in the database until an individual donor explicitly accepts a dispatch.



---

## Core Features & Workflow

The platform demonstrates the complete required flow: **Request $\rightarrow$ Match $\rightarrow$ Notify $\rightarrow$ Accept**.

* **Emergency Triage Request:** Hospital teams dispatch an emergency request specifying recipient MRN, facility wing, units needed, blood group, and district.


* **Algorithmic Donor Matching:** Automatically matches registered donors based on blood compatibility and enforces the 90-day cooldown interval.


* **Simulated Real-Time Dispatch / Notification:** Dispatches encrypted alerts to eligible matching volunteers across the target district.


* **Privacy-First Masking:** Donor numbers appear masked (`98•••••45`) by default across public queries.


* **Single-Donor Mutual Handshake:** Contact details are revealed exclusively for the first donor who accepts; once fulfilled, the ticket locks out secondary acceptances to prevent unneeded calls.


* **Interactive Persona Simulation:** Evaluators can switch roles in one click (Hospital Dispatcher vs. Volunteer Donor) to test the end-to-end user journey without registration hurdles.


* **District Reserves & Donor Onboarding:** Real-time visibility into blood inventory across Kerala's 14 districts and instant volunteer registration.



---

## Tech Stack

* **Frontend:** React 18, Vite


* **Styling:** Custom CSS featuring an organic storybook aesthetic with dual-palette wave elements
* **Typography:** Cormorant Garamond & Plus Jakarta Sans
* **Backend & Database:** Supabase (PostgreSQL)


* **Security & Privacy:**
* PostgreSQL Views (`public_eligible_donors`) for query-level number masking


* PostgreSQL `SECURITY DEFINER` RPC (`accept_donation_request`) for controlled contact unmasking upon explicit acceptance




* **Deployment:** Vercel



---

## Database Architecture

### 1. `donors` Table

Stores registered donors, districts, and the date of their last donation.

### 2. `requests` Table

Tracks patient hospital triage tickets, required blood groups, units, and dispatch status (`PENDING`, `ACCEPTED`).

### 3. `public_eligible_donors` (View)

A database abstraction that automatically:

* Computes `days_since_donation` against `current_date`.


* Evaluates `is_eligible` based on the 90-day cooldown threshold.


* Uses regex string manipulation to mask raw phone numbers (`98•••••45`).



### 4. `accept_donation_request` (RPC Function)

A secure stored procedure that:

* Validates ticket status.


* Sets request status to `ACCEPTED` and binds the donor ID.


* Returns the unmasked phone number solely to the matched session.



---

## Getting Started Locally

### Prerequisites

* Node.js (v18 or higher)
* A configured Supabase project

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/<your-username>/Redline_Prototype.git
cd Redline_Prototype

```


2. **Install dependencies:**
```bash
npm install

```


3. **Configure Environment Variables:**
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

```


4. **Run development server:**
```bash
npm run dev

```


5. **Build for production:**
```bash
npm run build

```



---

## Verification & Testing the Flow

1. **Hospital View:** Select a district (e.g., *Ernakulam*) and choose a blood group (e.g., *O+*).
2. Click **Broadcast Request**. A simulated dispatch notification will appear.


3. Under **Matched Donors**, observe that phone numbers are masked and cooldown-locked donors cannot be contacted.


4. Switch to **Donor Persona** from the top right switcher and select an eligible donor.


5. Click **Accept & Share My Number**.


6. Switch back to **Hospital View** or visit **Active Matches** to confirm that only the accepting donor's phone number has been revealed.
