# Infrastructure layer

Implements inward-facing ports and validation boundaries. Includes disabled authentication, server clock/UUID adapters, strict Zod request shape, and a dormant Netlify/Drizzle database factory. No repository queries or persistence operations are implemented. Never import these modules into browser presentation code.
