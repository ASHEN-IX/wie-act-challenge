# Single-instance realtime enforcement — 27 October 2026

Realtime remains process-local. Production startup now acquires one renewable
Mongo lease for the application database before serving traffic. A second API
owner is refused. Non-single realtime mode, multiple workers and secondary PM2
process identities fail closed. This enforces the current architecture rather
than claiming distributed fanout.

Mongo server time governs ownership and expiry. A conservative monotonic local
deadline fences HTTP entry, HTTP response writes and WebSocket sends before the
lease can expire. Stalled event loops cannot resume delivery after that deadline.
Ownership loss triggers graceful shutdown. Healthy processes renew; clean
shutdown releases ownership; a killed process retains ownership until expiry.
The compiled Nest entrypoint and source-loaded domain modules share one process
guard through a global registry.

Actual isolated Mongo tests verify duplicate-owner refusal, healthy renewal,
conservative stalled-owner fencing, orderly release, a SIGKILLed child process
and subsequent takeover, plus production configuration refusal. The resumed
combined suite passes 26 nodes including six lease test nodes, adaptive routing,
analytics and the shared deterministic visualization.

Evidence: `reports/evidence/ednova-final-20261027/resumed-core-tests.log`.
The original process-kill fixture killed the tsx launcher while its child remained
alive; it failed takeover correctly. The corrected fixture kills the complete
process group. An intervening Docker outage caused a separate connection-refused
run; neither is reported as a pass.

Remaining acceptance includes a full production-mode two-application HTTP/WS
rollout drill and deployment-specific Mongo outage/latency review. No distributed
realtime support or production certification is claimed. Operators must keep one
API process, one replica and one common application Mongo database; the lease
cannot coordinate accidentally separate databases.
