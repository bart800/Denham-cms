# Email Relink Log - 2026-02-18

## Problem
5,694 emails incorrectly assigned to DC-0003 (Franklin Crossroads Church). These were random Outlook inbox emails dumped into one case.

## Results
- **Relinked: 1,452 emails** to their correct cases
  - By client email match: 117
  - By client name in subject: 1,335
- **Deleted: 4,242 emails**
  - Noise (PNC alerts, Ambetter, GitHub, Adobe, newsletters, etc.): 367
  - Unmatched (internal staff emails, marketing, spam, misc): 3,875
- **DC-0003 emails remaining: 0**

## Final State
- Total emails in database: 1,606
- Cases with emails: 174 (up from ~30)

## Top Cases by Relinked Emails
- DC-0115 (Whaley): 188
- DC-0217 (Everett Crossing HOA): 50
- DC-0062 (Precision Metal Works): 44
- DC-0083 (Lake Village): 37
- DC-0034 (Beckner): 36

## Matching Strategy
1. Case ref (DC-XXXX) in subject line
2. Client email address in from/to/cc fields
3. Adjuster email in from/to/cc fields
4. Client last name / full name in subject line
5. Noise pattern detection for known spam/alerts
6. Remaining unmatched → deleted (general inbox noise)
