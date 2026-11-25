# deploy-frontend.ps1 - one-click frontend deploy for PadhakuGang
# Run from the padhakugang-react folder:
#   powershell -ExecutionPolicy Bypass -File .\deploy-frontend.ps1
#
# What it does:
#   1. Builds the site (npm run build - uses .env.production, so API = https://api.padhakugang.com)
#   2. Uploads dist/ to the server as /var/www/padhakugang-new
#   3. Swaps it in (old site kept as /var/www/padhakugang-old) and fixes permissions
#
# Rollback if something goes wrong (in an ssh session on the server):
#   cd /var/www && mv padhakugang padhakugang-bad && mv padhakugang-old padhakugang
#
# Keep the VPN OFF while deploying.

$ErrorActionPreference = "Stop"
$Server = "root@189.72.153.204"

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "[1/3] Building the site..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed - fix the error above, nothing was uploaded." }
if (-not (Test-Path "dist\index.html")) { throw "dist\index.html not found after the build." }

Write-Host ""
Write-Host "[2/3] Uploading to the server..." -ForegroundColor Cyan
ssh $Server "rm -rf /var/www/padhakugang-new"
if ($LASTEXITCODE -ne 0) { throw "Could not reach the server - check the internet / VPN." }
scp -r dist "${Server}:/var/www/padhakugang-new"
if ($LASTEXITCODE -ne 0) { throw "Upload failed. The live site is unchanged." }

Write-Host ""
Write-Host "[3/3] Swapping the new site in..." -ForegroundColor Cyan
$swap = @'
set -e
cd /var/www
test -f padhakugang-new/index.html
rm -rf padhakugang-old
if [ -d padhakugang ]; then mv padhakugang padhakugang-old; fi
mv padhakugang-new padhakugang
chmod -R a+rX padhakugang
echo "swapped"
'@
ssh $Server ($swap -replace "`r", "")
if ($LASTEXITCODE -ne 0) { throw "Swap failed - log in with ssh and check /var/www." }

Write-Host ""
Write-Host "DONE - open https://padhakugang.com and press Ctrl+F5 to see the new version." -ForegroundColor Green
