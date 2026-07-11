> **Live app:** A working MVP of this product is deployed at
> [`/moving-checklist/`](https://proxy-eval-max.github.io/moving-checklist/).
> Source is in [`moving-checklist/`](./moving-checklist/). See its
> [README](./moving-checklist/README.md) for setup.

# proxy-eval-max.github.io

**MoveAddress** is a web app (you sign in with Google) that builds a personalized moving address-change checklist. Tell it where and when you're moving, and it generates a prioritized, deadline-aware list of every organization, account, and government agency to notify — with official links, progress tracking, and confirmation numbers. Each person signs in with Google and their checklist is stored privately in their own Firebase account, readable only by them. It runs entirely as a static site on GitHub Pages at [`/moving-checklist/`](https://proxy-eval-max.github.io/moving-checklist/).

The rest of this document is the full product plan the app is based on.

# Website Product Plan: MoveAddress

## 1. Product overview

**MoveAddress** is a secure moving-address organizer that creates a personalized checklist of every organization, account, and government agency a user may need to notify when moving.

The website does not attempt to change every address automatically. Instead, it helps users:

* Identify which organizations need their new address
* Understand deadlines and requirements
* Complete tasks in the correct order
* Access official update pages
* Track confirmations and reference numbers
* Receive reminders before and after the move
* Avoid missing important mail, bills, registrations, or benefits

The initial launch can focus on people moving within the United States, with location-specific guidance for states and cities. Austin, Texas can serve as the first fully supported location.

---

# 2. Problem being solved

People changing homes often remember obvious tasks such as USPS forwarding but forget less visible records, including:

* Driver license
* Vehicle registration
* Voter registration
* Insurance
* Payroll
* Banks and investment accounts
* Toll accounts
* Medical providers
* Pet microchip records
* Professional licenses
* Immigration records
* Subscription deliveries

The information is scattered across government websites, service providers, emails, mobile apps, and paper records. Deadlines also vary by state and agency.

MoveAddress provides one organized workspace for the entire process.

---

# 3. Target users

## Primary users

### Renters moving within the same city

Typical needs:

* Transfer utilities
* Update renters insurance
* Change USPS forwarding
* Update identification and vehicle records
* Notify employer and banks
* Update subscriptions and deliveries

### Homeowners moving locally

Additional needs:

* Homeowners insurance
* Mortgage and property records
* HOA records
* Property-tax correspondence
* Home security and maintenance services

### People moving to another city or state

Additional needs:

* New driver license requirements
* Vehicle inspection or registration
* School districts
* Medical provider changes
* State taxes
* New utility providers

## Secondary users

* College students
* Military families
* Families managing a move for an elderly relative
* Immigration attorneys or relocation specialists
* Real-estate agents
* Corporate relocation teams
* Property managers

---

# 4. Core value proposition

The website should answer four questions clearly:

1. **Who needs my new address?**
2. **When do I need to update it?**
3. **Where do I complete the update?**
4. **How do I know I finished it?**

The product should feel like a guided moving assistant rather than a generic checklist.

---

# 5. Main user journey

## Step 1: Create a move

The user enters:

* Current ZIP code
* New ZIP code
* Move date
* Whether the move is within the same city, within the same state, or across states
* Whether they rent or own
* Whether they have a vehicle
* Whether they are registered to vote
* Whether they have children
* Whether they have pets
* Whether they receive government benefits
* Whether they are a U.S. citizen, permanent resident, visa holder, or prefer not to answer
* Whether they hold professional licenses
* Whether utilities are included in rent
* Whether they want email, SMS, or browser reminders

The user should not be required to enter their full street address during onboarding. ZIP codes and move type are sufficient to create the first checklist.

## Step 2: Generate a personalized checklist

The system creates tasks grouped by category:

* Mail and identity
* Government
* Vehicle and transportation
* Utilities
* Financial accounts
* Insurance
* Employment
* Health
* Family and education
* Pets
* Shopping and subscriptions
* Property and housing
* Immigration
* Professional licenses

Each task receives:

* Priority
* Recommended completion date
* Legal or practical deadline
* Official website link
* Required information
* Expected completion time
* Completion method
* Status

## Step 3: Guide the user through each task

When the user opens a task, the website displays:

* Why the update matters
* When it should be completed
* Whether it can be completed before the move
* Documents or information needed
* Official update link
* Step-by-step instructions
* Notes specific to the user’s state or city
* A completion checkbox
* Space for a confirmation number
* Space for private notes
* Option to upload a receipt or screenshot

## Step 4: Track progress

The dashboard shows:

* Percentage completed
* Overdue tasks
* Tasks due this week
* Tasks blocked until after the move
* High-priority items
* Recently completed items
* Items awaiting confirmation

## Step 5: Follow up after the move

The website continues reminders for 30–90 days.

Suggested follow-up prompts:

* Did USPS forwarding begin correctly?
* Did you receive your replacement driver license?
* Did your vehicle-registration address update?
* Did your security deposit arrive?
* Has mail continued arriving at the old address?
* Are any deliveries still being sent to the previous home?

---

# 6. Recommended website structure

## Public pages

### Home page

The home page should explain the product in one sentence:

> Build a personalized address-change checklist and complete every update on time.

Primary call to action:

**Create My Moving Checklist**

Secondary content:

* How it works
* Supported states
* Example checklist
* Privacy explanation
* Frequently asked questions
* Testimonials
* Partner section

### How it works

A simple three-step explanation:

1. Tell us about your move
2. Get a personalized checklist
3. Complete updates and track confirmations

### State guides

Create searchable pages such as:

* Moving within Texas
* Moving to Texas
* Moving out of Texas
* Texas driver-license address change
* Texas vehicle-registration address change
* Austin utility transfer guide

These pages can attract search traffic and direct visitors into the checklist tool.

### Pricing

The first version could offer:

* Free checklist
* Premium reminders and document storage
* Family or household plan
* Relocation-professional plan

### Privacy and security

This page should clearly state:

* What information is collected
* Why it is collected
* Whether information is sold
* How uploads are protected
* How users can delete their accounts
* Whether the website directly submits changes to third parties

---

# 7. Logged-in application pages

## Dashboard

The dashboard should contain:

* Move date countdown
* Progress ring
* Next three recommended tasks
* High-priority alerts
* Category progress
* Recent activity
* Reminder settings
* Household members

Example:

**20 days until your move**

* 5 tasks completed
* 7 tasks due before moving
* 4 tasks must be completed after moving
* 3 optional tasks

## Checklist page

Filters:

* All
* Due soon
* Overdue
* Before move
* Moving day
* After move
* Completed
* Optional
* Assigned to me
* Assigned to another household member

Sorting options:

* Recommended order
* Deadline
* Priority
* Category
* Estimated time

## Task detail page

Each task should include:

### Task title

Example: Update Texas driver license address

### Summary

A brief explanation of the requirement.

### Timing

* Earliest completion date
* Recommended date
* Legal deadline
* Estimated completion time

### Preparation checklist

* Driver license number
* Date of birth
* Social Security number or required identifying digits
* Payment method
* New residential address

### Official action button

**Go to Official Website**

The site should visibly label external links as official government or provider websites.

### Progress controls

* Not started
* In progress
* Submitted
* Waiting for confirmation
* Completed
* Not applicable

### Record keeping

* Confirmation number
* Submission date
* Expected response date
* Notes
* Attachment upload

## Calendar or timeline page

Display the move as a timeline:

* 30 days before
* 20 days before
* 14 days before
* 7 days before
* Moving day
* 10 days after
* 30 days after
* 60 days after

Tasks should appear under the most appropriate date.

## Household page

Users can add:

* Spouse or partner
* Children
* Roommates
* Dependents
* Vehicles
* Pets

Tasks can then be assigned to individuals.

Examples:

* Alex: update employer and bank
* Jordan: transfer utilities
* Household: USPS forwarding
* Vehicle 1: update registration
* Pet 1: update microchip record

## Documents page

Optional encrypted storage for:

* Lease
* Utility confirmations
* Insurance declarations
* Driver-license receipt
* Vehicle-registration receipt
* Moving contract
* Inventory
* Security-deposit correspondence

Files should be organized by task rather than placed in one unstructured folder.

## Settings page

Include:

* Profile
* Move details
* Notification preferences
* Household members
* Privacy controls
* Data export
* Account deletion
* Connected accounts
* Subscription management

---

# 8. Task categories and examples

## Mail and identity

* USPS mail forwarding
* Driver license or state ID
* Passport application address, when applicable
* Trusted traveler programs
* Identity-protection services

## Vehicle and transportation

* Vehicle registration
* Vehicle title record
* Auto insurance
* Toll account
* Parking permit
* Roadside assistance
* Vehicle lease or loan
* Rideshare profiles

## Government

* Voter registration
* IRS
* State tax agency
* Social Security, when applicable
* Medicare or Medicaid
* Veterans Affairs
* Unemployment benefits
* Public assistance programs
* Child-support agency

## Immigration

* USCIS address change
* Immigration court records, when applicable
* Sponsor or attorney records
* Pending visa or immigration application contacts

Because immigration requirements can carry legal consequences, the website should state that guidance is informational and direct users to official sources.

## Housing and utilities

* Current landlord
* New landlord
* Electricity
* Water
* Natural gas
* Trash and recycling
* Internet
* Cable
* Home phone
* Security system
* HOA
* Property manager
* Mortgage servicer

## Financial accounts

* Bank
* Credit cards
* Investment accounts
* Retirement accounts
* Payment apps
* Loan providers
* Tax preparer
* Financial adviser

## Insurance

* Renters insurance
* Homeowners insurance
* Auto insurance
* Health insurance
* Life insurance
* Dental insurance
* Vision insurance
* Pet insurance

## Employment

* Employer
* Payroll
* Benefits administrator
* Retirement plan
* Professional association
* Union
* Emergency-contact records

## Health

* Primary-care doctor
* Specialists
* Dentist
* Pharmacy
* Prescription-delivery provider
* Health portal
* Medical-equipment provider

## Family and education

* School
* Daycare
* University
* Tutoring program
* After-school activities
* Emergency contacts

## Pets

* Veterinarian
* Microchip registry
* Pet license
* Pet insurance
* Boarding or daycare provider

## Shopping and subscriptions

* Online retailers
* Grocery delivery
* Food delivery
* Subscription boxes
* Magazines
* Newspapers
* Mobile-phone account
* Memberships
* Loyalty programs

---

# 9. Personalization engine

The checklist engine is the most important part of the product.

## Inputs

The system should use:

* Old state
* New state
* Old city
* New city
* Move date
* Rent or own
* Vehicle ownership
* Voter-registration status
* Citizenship or immigration context
* Employment status
* Children
* Pets
* Government benefits
* Professional licenses
* Household composition
* Utility arrangements

## Rule examples

### Example 1

If:

* User is moving within Texas
* User owns a vehicle

Then add:

* Texas driver-license address
* Texas vehicle-registration address
* Auto-insurance garaging address
* Toll account
* Vehicle lender or leasing company

### Example 2

If:

* User is a permanent resident or visa holder

Then add:

* USCIS address-change task
* Strong deadline warning
* Official USCIS link
* Disclaimer that USPS forwarding does not update USCIS

### Example 3

If:

* User rents
* Utilities are included

Then:

* Do not add electricity and water transfer as required tasks
* Add “Confirm utility responsibility with landlord”
* Keep internet as a separate task

### Example 4

If:

* User is moving to another state

Then add:

* New driver-license application
* New vehicle registration
* Vehicle inspection or emissions requirements
* Old-state voter-registration review
* State tax considerations
* New health-insurance network review

---

# 10. Task data model

Each checklist task should contain structured fields.

## Task fields

* Task ID
* Task title
* Category
* Description
* Reason
* Applicable locations
* User eligibility rules
* Priority
* Earliest completion date
* Recommended offset from move date
* Legal deadline
* Deadline source
* Before-or-after-move restriction
* Official URL
* Agency or organization
* Completion method
* Estimated time
* Expected cost
* Required documents
* Required information
* Instructions
* Reminder schedule
* Review date
* Source verification date
* Status
* User notes
* Confirmation number
* Attachments
* Assigned household member

## Status values

* Not started
* In progress
* Submitted
* Waiting for confirmation
* Completed
* Not applicable
* Skipped

---

# 11. Reminder system

## Reminder channels

* Email
* SMS
* Browser notifications
* In-app notifications
* Calendar export

## Default reminder schedule

### Before moving

* 30 days before
* 21 days before
* 14 days before
* 7 days before
* 2 days before

### After moving

* Moving day
* 3 days after
* 10 days after
* 30 days after
* 60 days after

## Smart reminder rules

The system should avoid sending reminders for every task separately.

Instead, send grouped messages such as:

> Three important tasks are due this week: USPS forwarding, renters insurance, and internet transfer.

High-risk deadlines can receive separate reminders.

Example:

> Your USCIS address-change deadline is in three days.

## Reminder actions

Each reminder should allow the user to:

* Open the task
* Mark it complete
* Snooze it
* Mark it not applicable
* Reassign it

---

# 12. Austin-specific first release

Austin is a strong pilot city because the product can support detailed local guidance.

## Initial Austin checklist coverage

* USPS
* Texas Department of Public Safety
* Texas Department of Motor Vehicles
* Texas voter registration
* IRS
* USCIS
* City of Austin Utilities
* Austin Energy
* Austin Water
* Austin Resource Recovery
* Texas Gas Service, where applicable
* Internet providers
* Toll accounts
* Travis County vehicle and tax services
* Williamson County services for relevant ZIP codes
* Renters and homeowners insurance
* Austin Public Library
* Local parking permits, where applicable
* School-district records

The website should determine whether a user is in Travis County, Williamson County, Hays County, or another jurisdiction rather than assuming every Austin mailing address uses the same county services.

---

# 13. Search and discovery features

Users will not always remember the name of an account.

Provide a search box with prompts such as:

* “Who else should I notify?”
* “I have a dog”
* “I work remotely”
* “I receive Social Security”
* “I have a Texas nursing license”
* “My child is changing schools”

Search results can recommend new tasks.

The system should also display a category review:

> You have not added any health-care providers. Would you like to review that category?

---

# 14. Optional email-based account discovery

A future version could let users connect Gmail or Outlook.

The product could search for likely service providers based on emails such as:

* Utility bills
* Bank statements
* Insurance notices
* Subscription receipts
* Medical appointment confirmations
* Toll notices
* Membership renewals

The system should never read unrelated email content unnecessarily.

A safer design is to:

1. Search for known billing and service patterns
2. Show suggested organizations
3. Let the user approve each suggestion
4. Avoid storing complete email bodies

Example suggestion:

> We found recent emails from Austin Energy. Add Austin Energy to your checklist?

This feature should be optional and require explicit consent.

---

# 15. Automatic and assisted updates

## MVP approach

The first version should link users to official websites and help them track completion.

This is faster, safer, and easier than attempting direct submissions.

## Future assisted-update approach

For selected private companies, the website could:

* Prefill address-change forms
* Generate a downloadable address-change letter
* Open the correct account page
* Provide copy-ready old and new address fields

## Direct-update approach

Direct automatic changes should only be offered when:

* An official API exists
* The user clearly authorizes the update
* Identity verification is secure
* Confirmation is returned
* The website can reliably handle errors

Government updates should not be represented as complete unless the relevant government system confirms completion.

---

# 16. Security and privacy

The website will handle sensitive personal information and should follow a data-minimization approach.

## Data that should not be required for the basic checklist

* Social Security number
* Driver-license number
* Passport number
* Bank-account number
* Full date of birth

Users should enter sensitive identifiers directly on official websites rather than storing them in MoveAddress.

## Recommended safeguards

* HTTPS everywhere
* Encryption at rest
* Encrypted document uploads
* Multi-factor authentication
* Short-lived login sessions for sensitive areas
* Audit log for account activity
* Regular backups
* Malware scanning for uploads
* Role-based administrative access
* Automatic deletion of abandoned accounts
* User-controlled account deletion
* Data export
* Clear consent for email or calendar connections

## Privacy principles

* Do not sell personal moving data
* Do not use address information for unrelated advertising
* Do not share full addresses with partners without consent
* Explain each third-party integration
* Let users use the checklist without storing their full address
* Separate product analytics from personally identifiable data

---

# 17. Legal and content safeguards

The website should include a visible disclaimer:

* Information is provided for organizational purposes
* Requirements can change
* Official agency instructions control
* The product is not a law firm
* Immigration, tax, and legal guidance is not legal advice
* Users should verify high-stakes requirements with official sources

Each government task should display:

* Official source
* Date last verified
* State or jurisdiction
* Link to the official page

The content-management system should flag guidance for periodic review.

---

# 18. Administrative content system

A reliable admin portal is needed to maintain changing requirements.

## Admin capabilities

* Create and edit tasks
* Add state-specific rules
* Add city and county rules
* Update official links
* Change deadlines
* Mark guidance as under review
* Set verification dates
* View broken-link reports
* Publish content changes
* Review user-submitted corrections
* Maintain utility-provider coverage by ZIP code

## Content review process

High-risk tasks should be reviewed more frequently:

* Immigration
* Driver licensing
* Vehicle registration
* Taxes
* Government benefits
* Voting

Lower-risk tasks can be reviewed less frequently:

* Shopping accounts
* Gym memberships
* Subscription services

---

# 19. User-experience principles

## Make tasks feel manageable

Do not show a user 70 tasks without context.

Instead, group them into:

* 8 important tasks
* 12 recommended tasks
* 15 optional tasks

## Use clear language

Prefer:

> Update your driver-license address

Avoid:

> Modify state-issued identity credential information

## Explain why tasks appear

Each personalized task should include:

> This task appears because you told us that you own a vehicle and are moving within Texas.

## Avoid false urgency

Use urgency only when a real deadline exists.

Suggested labels:

* Legally required
* Financially important
* Prevents service interruption
* Recommended
* Optional

## Support accessibility

* Keyboard navigation
* Screen-reader labels
* High contrast
* Large tap targets
* Clear error messages
* Mobile-friendly forms
* Plain-language instructions
* Spanish-language support in a later release

---

# 20. Mobile design

Many users will complete tasks on their phones while moving.

The mobile experience should prioritize:

* Today’s tasks
* One-tap official links
* Mark complete
* Upload confirmation photo
* Add confirmation number
* Snooze
* Call provider
* Copy new address

A persistent button could display:

**Copy New Address**

The copied format should be standardized for forms.

---

# 21. Suggested technology architecture

## Front end

* React or Next.js
* Responsive web design
* Progressive Web App support
* Accessible component library

## Back end

* Node.js, Python, or another mature web framework
* REST or GraphQL API
* PostgreSQL database
* Background job system for reminders
* Object storage for encrypted files
* Authentication provider with MFA support

## Infrastructure

* Managed cloud hosting
* Content delivery network
* Automated backups
* Error monitoring
* Security logging
* Web application firewall
* Rate limiting
* Staging and production environments

## Integrations

Initial integrations:

* Email delivery
* SMS provider
* Calendar export
* ZIP-code and jurisdiction lookup
* Address validation
* Error monitoring
* Product analytics

Future integrations:

* Gmail and Outlook
* Moving companies
* Utility providers
* Insurance partners
* Property-management systems
* Employer relocation platforms

---

# 22. Basic database structure

## Users

* User ID
* Name
* Email
* Phone
* Time zone
* Notification preferences
* Account status

## Moves

* Move ID
* User ID
* Old ZIP code
* New ZIP code
* Move date
* Move type
* Housing type
* Status

## Household members

* Member ID
* Move ID
* Name
* Relationship
* Assigned tasks

## User attributes

* Vehicle ownership
* Pets
* Children
* Voter status
* Immigration category
* Benefits
* Professional licenses

## Task templates

* Template ID
* Location rules
* Eligibility rules
* Instructions
* Deadline logic
* Official links

## User tasks

* User-task ID
* Task-template ID
* Move ID
* Status
* Due date
* Assigned member
* Completion date
* Notes
* Confirmation details

## Attachments

* Attachment ID
* User-task ID
* Encrypted file location
* File type
* Upload date

## Notifications

* Notification ID
* User ID
* User-task ID
* Delivery channel
* Scheduled time
* Delivery status

---

# 23. Minimum viable product

The MVP should focus on the core problem and avoid unnecessary automation.

## MVP features

* Account creation
* Move onboarding questionnaire
* Personalized checklist
* Austin and Texas rules
* Generic national checklist
* Task status tracking
* Official links
* Due dates
* Email reminders
* Notes and confirmation numbers
* Mobile-responsive interface
* Basic admin content management
* Privacy controls
* Account deletion

## Features to postpone

* Direct automatic address updates
* Email account scanning
* SMS reminders
* Document uploads
* Household collaboration
* Native mobile apps
* Provider marketplace
* AI chat assistant
* Multi-country support

---

# 24. Development phases

## Phase 1: Research and content design

Deliverables:

* Complete national task taxonomy
* Texas-specific rules
* Austin utility and local-service mapping
* Deadline framework
* Official-link verification process
* User interviews
* Low-fidelity wireframes

## Phase 2: MVP build

Deliverables:

* Authentication
* Onboarding questionnaire
* Rule-based checklist generator
* Dashboard
* Task detail pages
* Email reminders
* Admin content editor
* Mobile-responsive design

## Phase 3: Private beta

Recruit:

* Austin renters
* Austin homeowners
* People moving within Texas
* Real-estate agents
* Property managers

Measure:

* Checklist completion
* Missed-task reports
* Confusing instructions
* Broken links
* Reminder usefulness
* Time to first completed task

## Phase 4: Public Austin launch

Add:

* ZIP-code jurisdiction detection
* Local utility guidance
* Austin-focused search pages
* Customer support
* Referral program
* Premium plan

## Phase 5: Texas expansion

Support:

* Houston
* Dallas
* Fort Worth
* San Antonio
* El Paso
* Other Texas counties and utility providers

## Phase 6: National expansion

Prioritize states based on:

* Population
* Moving volume
* Complexity of licensing rules
* Availability of official online services
* User demand

---

# 25. Revenue model

## Free plan

* Personalized checklist
* Official links
* Basic progress tracking
* Basic email reminders

## Premium individual plan

Possible one-time moving fee or short subscription.

Features:

* Advanced reminder scheduling
* Household collaboration
* Document storage
* Confirmation tracking
* Calendar synchronization
* Exportable move report
* Priority support

## Professional plan

For:

* Real-estate agents
* Apartment communities
* Moving companies
* Relocation consultants
* Employers

Features:

* Branded checklists
* Client invitations
* Progress overview
* Bulk move creation
* Templates
* Team access
* Analytics

## Partnership revenue

Potential partners:

* Internet providers
* Moving companies
* Insurance providers
* Storage companies
* Cleaning services
* Utility-comparison services

Partner recommendations must be clearly separated from required tasks. Sponsored services should never influence government or legal guidance.

---

# 26. Success metrics

## Activation

* Percentage of visitors who create a move
* Percentage who finish onboarding
* Percentage who complete one task on the first visit

## Engagement

* Tasks completed per user
* Reminder open rate
* Weekly returning users
* Checklist completion rate
* Number of confirmation records saved

## Outcome metrics

* Percentage of users who complete high-priority tasks by deadline
* Percentage reporting no missed important address updates
* Reduction in returned mail
* Reduction in interrupted utilities
* User confidence score

## Quality metrics

* Broken official links
* Outdated guidance reports
* Support requests per user
* Task-not-applicable rate
* Incorrect personalization reports

---

# 27. Example onboarding for an Austin user

The website asks:

1. When are you moving?
2. What is your current ZIP code?
3. What is your new ZIP code?
4. Are you renting or buying?
5. Do you own or lease a vehicle?
6. Are utilities included in your rent?
7. Are you registered to vote?
8. Do you have pets?
9. Do you have children enrolled in school or daycare?
10. Do you receive government benefits?
11. Do you need immigration-related reminders?
12. Would you like email reminders?

The system then generates:

## Complete before moving

* Schedule USPS forwarding
* Transfer City of Austin utilities
* Schedule internet installation
* Update renters insurance
* Notify landlord
* Update employer and payroll
* Update banks and credit cards

## Complete immediately after moving

* Update Texas driver license
* Update vehicle registration
* Update voter registration
* Update auto insurance garaging address
* Update toll account
* Update IRS address

## Conditional tasks

* USCIS address update
* School records
* Pet microchip registry
* Government-benefit programs
* Professional licenses

---

# 28. Example task card

## Update Texas driver-license address

**Priority:** High
**Status:** Not started
**Recommended timing:** Within the first week after moving
**Estimated time:** 10–15 minutes
**Method:** Online or through the appropriate state process

### Why this matters

Your driver-license record should reflect your current residential address. State deadlines may apply.

### Prepare

* Current driver license
* New residential address
* Payment method
* Identity-verification information

### Steps

1. Open the official Texas driver-license address-change page.
2. Confirm that you are eligible to complete the change online.
3. Enter the requested information.
4. Review the new address carefully.
5. Pay any required replacement fee.
6. Save the confirmation number.
7. Mark this task as submitted.
8. Mark it complete when the replacement document arrives.

**Button:** Open Official Texas Website

**Confirmation number:** __________

**Expected completion date:** __________

---

# 29. Risks and mitigations

## Risk: Information becomes outdated

Mitigation:

* Store verification dates
* Schedule content reviews
* Monitor broken links
* Let users report inaccurate guidance
* Prefer official government sources

## Risk: Users believe the website completed an update

Mitigation:

* Clearly distinguish “opened,” “submitted,” and “confirmed”
* Never mark external tasks complete automatically
* Require user confirmation
* Display external-site notices

## Risk: Too many tasks overwhelm users

Mitigation:

* Prioritize essential tasks
* Hide optional items by default
* Use weekly task groups
* Explain why each task was included

## Risk: Sensitive-data exposure

Mitigation:

* Minimize collected data
* Do not store government identifier numbers
* Encrypt uploads
* Provide MFA
* Allow full account deletion

## Risk: Incorrect legal interpretation

Mitigation:

* Use official sources
* Avoid presenting guidance as legal advice
* Add jurisdiction and verification dates
* Escalate high-risk content for expert review

---

# 30. Recommended first version

The strongest first version would be:

* A responsive website
* Focused on moves within Texas
* Fully detailed for Austin
* Free to create a checklist
* Built around official links and deadline tracking
* Supported by email reminders
* Designed without requiring highly sensitive personal data

The product should initially win through accuracy, simplicity, and strong local personalization rather than complicated automation.

Its central promise should be:

> Tell us where and when you are moving, and we will organize every address update into one clear, personalized plan.

