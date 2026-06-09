param(
  [Parameter(Mandatory)]
  [ValidateSet("12pm","2pm","4pm","6pm")]
  [string]$Time,
  [string]$SupabaseUrl,
  [string]$Secret
)

$Date = Get-Date -Format "MMMM dd, yyyy"

# Gather git log from last 3 hours
$Since = (Get-Date).AddHours(-3).ToString("yyyy-MM-ddTHH:mm:ssZ")
$GitLog = & git log --since="$Since" --oneline --no-decorate 2>$null
if (-not $GitLog) {
  $GitLog = "- No new commits in this period"
}

# Format bullets
$Lines = $GitLog -split "`n" | ForEach-Object { "- $_" }
$Bullets = $Lines -join "`n"

$IsEod = $Time -eq "6pm"

if ($IsEod) {
  $Subject = "End of Duty Report - $Date"
  $Body = @"
END of Duty report $Date Time[12PM - 6PM] Accomplished Task:
$Bullets
"@
} else {
  $Subject = "$Time Pacific check-in - $Date"
  $Body = @"
$Time check-in
$Bullets
"@
}

# Write to temp file, open for editing
$TempFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$', '.txt'
$Body | Out-File -FilePath $TempFile -Encoding utf8

Write-Host "`nReport draft written to: $TempFile" -ForegroundColor Cyan
Write-Host "Edit the file, save, then close it when done (or just close to send as-is)." -ForegroundColor Yellow
Write-Host "Press any key to open the editor..." -ForegroundColor Green
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Open in default text editor
Invoke-Item $TempFile

Write-Host "`nWaiting for you to save and close the file..." -ForegroundColor Yellow
Write-Host "Press any key after you've finished editing..." -ForegroundColor Green
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

$EditedBody = Get-Content $TempFile -Raw -Encoding utf8
Remove-Item $TempFile -Force

# Send
$Payload = @{
  subject = $Subject
  body    = $EditedBody
  type    = if ($IsEod) { "eod" } else { "check-in" }
} | ConvertTo-Json

$Url = "$SupabaseUrl/functions/v1/send-work-report"
$Headers = @{
  Authorization = "Bearer $Secret"
  "Content-Type" = "application/json"
}

Write-Host "`nSending report..." -ForegroundColor Cyan

try {
  $Response = Invoke-RestMethod -Uri $Url -Method Post -Headers $Headers -Body $Payload
  Write-Host "Report sent successfully!" -ForegroundColor Green
} catch {
  Write-Host "Failed to send report: $_" -ForegroundColor Red
}
