# Workspace & Membership

Owns tenant roots, personal/business types, membership roles/status, and immutable lifecycle transitions. Workspace creation and owner membership persistence must be atomic. Domain factories enforce object-local rules; uniqueness and cross-row owner guarantees require transaction/database enforcement. Application authorization depends on verified identity and scoped server-side repository ports.
