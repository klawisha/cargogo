# CargoGo v1.6.3 — Privacy Workflow & Readiness Motion

## Production readiness
- Refresh control now has a native-driver rotation animation while the readiness snapshot is loading.
- Repeated taps are ignored while a refresh is already in progress.
- The release gate displays a short live synchronization state during refresh.

## Privacy rights workflow
- Privacy actions no longer create empty generic tickets.
- ACCESS requests require the user to specify the requested data scope and optional details.
- CORRECTION requests require the current/incorrect value and the requested new value, with an optional explanation.
- RESTRICTION requests require the processing scope and reason.
- DELETION requests require explicit typed confirmation and preserve lawful retention behavior.
- Structured request details are stored in `privacy_request.request_payload`.
- Reviewer queue shows the actual request details and supports OPEN → IN REVIEW → COMPLETED/REJECTED.
- A final reviewer response is mandatory before COMPLETED or REJECTED.
- The user sees request status, submitted details and CargoGo's final response in the Privacy Center.
- Audit events distinguish review start from final resolution.

## Database
Run `npm run db:migrate` to apply `031_privacy_request_workflow.sql` before using the new privacy forms.
