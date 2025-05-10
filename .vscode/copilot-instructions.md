# Project

- We use react-router framework mode
- We have a cloudflare d1 database and use it using drizzle
- Use Drizzle-kit to create database migrations, migration command: npm run db:migrate
- Always use useFetcher instead of plain fetchs unless I tell you otherwise.
- We use typescript and try to write everything in a typesafe manner
- When referencing types for well known database objects consult the drizzle schema instead of typing it inline

I'm building a software to manage my building. I'm the building's treasurer. The other apartment owners deposit money into my bank account to pay the building's common expenses. Given that the apartment complex has 27 apartments I need to keep track of all of the inflows and outflows of money.
