param(
    [Parameter(Mandatory = $true)]
    [string]$Body,

    [ValidateSet("notify", "status", "alert")]
    [string]$TemplateKey = "notify",

    [ValidateSet("mortis-ai", "mortis-watch", "mortis-ops")]
    [string]$SourceTag = "mortis-ai",

    [string]$RemoteHost = "ubuntu@124.220.233.126"
)

$ErrorActionPreference = "Stop"

$AllowedGroupId = "689863409"

if ([string]::IsNullOrWhiteSpace($Body)) {
    throw "Body cannot be empty."
}

$normalizedBody = $Body.Trim()
$bodyB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($normalizedBody))

$remoteCommand = @"
python3 /home/ubuntu/multica-public-watch/control/send_napcat_group.py --group-id '$AllowedGroupId' --template-key '$TemplateKey' --source-tag '$SourceTag' --body-b64 '$bodyB64'
"@

Write-Host "Sending constrained NapCat group message to group $AllowedGroupId via $RemoteHost..."
Write-Host "TemplateKey=$TemplateKey SourceTag=$SourceTag"
$result = & ssh $RemoteHost $remoteCommand
if ($LASTEXITCODE -ne 0) {
    throw "Remote NapCat send failed with exit code $LASTEXITCODE."
}

if ($result) {
    $result
}
