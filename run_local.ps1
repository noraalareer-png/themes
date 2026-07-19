# run_local.ps1 - run the full theme-QA pipeline locally (Windows PowerShell).
# Each theme's results go to runs\<theme_id>\ so nothing overwrites.
# Usage:
#   .\run_local.ps1 -PreviewBase "https://i1o0np.dev.zid.store" -ThemeId "<uuid>" [-Preset preset.json]
param(
  [Parameter(Mandatory=$true)][string]$PreviewBase,
  [Parameter(Mandatory=$true)][string]$ThemeId,
  [string]$Preset
)

$env:PREVIEW_BASE = $PreviewBase
$env:THEME_ID     = $ThemeId
$outDir = "runs\$ThemeId"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Write-Host "`n=== Layer 1: structural gate (/validate) ===" -ForegroundColor Cyan
py validate_check.py --preview $PreviewBase --theme $ThemeId
$layer1 = $LASTEXITCODE

if ($Preset) {
  Write-Host "`n=== Sections: parsing preset ===" -ForegroundColor Cyan
  py sections_from_preset.py $Preset --out sections.json
} else {
  Remove-Item -ErrorAction SilentlyContinue sections.json
}

Write-Host "`n=== Layer 2: functional / visual E2E ===" -ForegroundColor Cyan
npx playwright test
$layer2 = $LASTEXITCODE

Write-Host "`n=== Layer 3: finalize (dry-run) ===" -ForegroundColor Cyan
node scripts\finalize.js

Write-Host "`n--- Summary ---" -ForegroundColor Yellow
Write-Host ("Layer 1 (structural): {0}" -f $(if ($layer1 -eq 0) {"PASS"} else {"FAIL"}))
Write-Host ("Layer 2 (E2E):        {0}" -f $(if ($layer2 -eq 0) {"PASS"} else {"had failures"}))
Write-Host "`nResults saved in: $outDir" -ForegroundColor Green
Write-Host ("Open the report:  npx playwright show-report {0}\playwright-report" -f $outDir) -ForegroundColor Green
