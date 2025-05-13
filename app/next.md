## current balance

agregar el monto estimado de dinero en la cuenta en el homepage y agregar un subitem en el menu actualizar monto

## next

I want to be able to upload bills to transactions. This new entity will be called attachments.

I just configured an R2 bucket and is accessible via env.R2. Read this documentation to know how to do it: https://developers.cloudflare.com/r2/api/workers/workers-api-usage/

Create a manager class (similar to transactionService) to abstract the R2 file operations, then inject that class into the context (check workers/app.ts)

## In the transaction details menu allow to upload pdfs or images, store the file id in the transacrtion db

Now that we have users I want to store user operations. I want to create an audit_log table that stores when we do changes to any table in the db (transactions, tags, owners, transaction_tags, )

create customized repository for each of our stuff

---

transactions without tags
