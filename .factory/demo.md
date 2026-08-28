# Pantry Check demo

- URL: `/demo` (or `/?demo=1`). The landing-page **Try it with sample data** link opens `/demo` in one click.
- Sample: Oat milk, Frozen peas, Red lentils, and a used Pasta record that appears in Shopping. The sample gives the pantry, check, shopping, and settings screens meaningful content immediately.
- Isolation: demo data uses IndexedDB database `demo:pantry-check`. Real use uses `pantry-check`; the two databases are never read or written together.
- Reset: **Reset demo** deletes only `demo:pantry-check` and reseeds the sample. **Start for real** opens `/`, which uses the real empty/local pantry and never copies demo records.
- Offline: visit `/demo` once online, then reload while offline to use the seeded sample from the PWA shell and demo IndexedDB.
