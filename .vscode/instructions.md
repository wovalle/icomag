I'm building a software to manage my building. I'm the building's treasurer. The other apartment owners deposit money into my bank account to pay the building's common expenses. Given that the apartment complex has 27 apartments keeping track of all of the inflows and outflows of money.

Global requirements:

sidebar
magic link login
my apartment complex is located in santo domingo, dominican republic but the software will be only used by english speakers. So the software will be in English.
you'll need a db, use postgres and prisma
make it look decent in mobile
This software will have multiple modules:

Here's the first module you'll implement:
Transactions File processing: periodically I'll download a CSV file from the bank with all of the transactions of my building. I will upload this file to the software and it will process it and create a transaction for each line in the CSV file. Given than I'll export this file irregularly, I need to be able to process the file multiple times. The software will keep track of which transactions have already been processed and which ones haven't. The software will also keep track of each file (batch) that has been processed. Each file will have a unique identifier and the software will keep track of which transactions belong to which file. The software will also keep track of the date and time when each file was processed. The software will also keep track of which transactions were repeated on a batch and which ones were new.
What you'll build: Create a Page where you can upload a transaction csv file. I'm attaching a sample file (see Banco Popular Dominicano 537-2.csv). This is not a regular file cause the 6 first lines are generic data: name, account type and so on. then in line 7 you see the headers of the transactions and from there it's a regular CSV file. The software will need to ignore the first 6 lines and start processing from line 7. Create a page where you can see the list of all the files that have been processed. And for each file, you can see the list of transactions that belong to that file and the status of each transaction (new, repeated, etc).

Transaction datagrid: Once the batches are processed we'll save the info in a transactions master table. this table will also have more fields:

A description (this field will be editable inline in the datagrid, I want to quickly edit the description of a transaction to add context)

each transaction can also be assigned one or many categories so you'll need to create a categories master table and do a many to many with the transactions master table

transaction kind: debit, credit, reversal

date

amount

bank id (is named serial in the csv)

bank description

payer (for debit transactions we can see the serial and relate it to a owner, allow me to specify an owner if it couldn't be related automatically ) this datagrid should be paginated, should allow me to filter by one or more categories, also for transaction kind. it should be orderable by date (desc by default)

crm: I'll have debit transactions and I want to relate those transactions to the home owners to see if they have paid their monthly payment or not. I 'll have a crm where I'll have a list of the owners, I can create new owners and I'll be able to save a name and which apartment he lives and a list of bank account numbers so when I import debit transactions if it was deposited by them we'll automatically relate a payment transaction to its owne
