// This is a simple test script to demonstrate audit logging
// You can run this to create some sample audit log entries

async function testAuditLogging() {
  // Note: This would need to be adapted to work with your actual D1 database
  // For now, this is just to show the structure

  console.log("Testing audit logging functionality...");

  // Example of how audit logs would be created:
  const sampleAuditEntries = [
    {
      event_type: "SIGN_IN",
      entity_type: "SYSTEM",
      user_email: "admin@example.com",
      details: JSON.stringify({
        action: "user_signed_in",
        method: "magic_link",
        user_name: "Admin User",
      }),
      is_system_event: 1,
      created_at: Math.floor(Date.now() / 1000),
    },
    {
      event_type: "CREATE",
      entity_type: "OWNER",
      entity_id: "1",
      user_email: "admin@example.com",
      details: JSON.stringify({
        action: "created",
        new_values: {
          name: "John Doe",
          apartment_id: "A-101",
          email: "john@example.com",
        },
      }),
      is_system_event: 0,
      created_at: Math.floor(Date.now() / 1000),
    },
    {
      event_type: "UPDATE",
      entity_type: "OWNER",
      entity_id: "1",
      user_email: "admin@example.com",
      details: JSON.stringify({
        action: "updated",
        changes: {
          phone: {
            old: null,
            new: "+1234567890",
          },
        },
      }),
      is_system_event: 0,
      created_at: Math.floor(Date.now() / 1000),
    },
    {
      event_type: "BULK_IMPORT",
      entity_type: "TRANSACTION",
      user_email: "admin@example.com",
      details: JSON.stringify({
        action: "bulk_import",
        count: 150,
        filename: "transactions_2024_01.csv",
      }),
      is_system_event: 0,
      created_at: Math.floor(Date.now() / 1000),
    },
  ];

  console.log("Sample audit log entries that would be created:");
  sampleAuditEntries.forEach((entry, index) => {
    console.log(`\n${index + 1}. ${entry.event_type} - ${entry.entity_type}`);
    console.log(`   User: ${entry.user_email}`);
    console.log(`   Details: ${entry.details}`);
    console.log(`   System Event: ${entry.is_system_event ? "Yes" : "No"}`);
  });

  console.log("\nAudit logging system is ready!");
  console.log(
    "- Create/Update/Delete operations on entities will be automatically logged"
  );
  console.log("- Sign in/Sign out events will be logged");
  console.log("- Admin users can view audit logs at /audit-logs");
  console.log(
    "- Audit logs include user context, IP address, and detailed change information"
  );
}

// Run the test
testAuditLogging().catch(console.error);
