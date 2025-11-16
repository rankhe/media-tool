# PowerShell script to execute PostgreSQL migration
$env:PGPASSWORD = "123456"
psql -U postgres -d media_tool -f api/migrations/add_social_monitoring_local.sql