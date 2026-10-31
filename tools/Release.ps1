param([string]$Runtime = 'win-x64')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
[xml]$project = Get-Content (Join-Path $projectRoot 'MinhaCaptura.csproj')
$version = $project.Project.PropertyGroup.Version
$name = "MinhaCaptura-v$version-$Runtime"
$output = Join-Path $projectRoot "artifacts/$name"
dotnet publish (Join-Path $projectRoot 'MinhaCaptura.csproj') -c Release -r $Runtime --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:DebugType=None -o $output
if ($LASTEXITCODE -ne 0) { throw 'Falha ao publicar a release.' }
Copy-Item -LiteralPath (Join-Path $projectRoot 'LICENSE') -Destination $output
Copy-Item -LiteralPath (Join-Path $projectRoot 'README.md') -Destination $output
Copy-Item -LiteralPath (Join-Path $projectRoot 'CHANGELOG.md') -Destination $output
$archive = Join-Path $projectRoot "artifacts/$name.zip"
Compress-Archive -Path "$output/*" -DestinationPath $archive -Force
$hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText("$archive.sha256", "$hash  $name.zip`n")
Write-Output "Release: $archive"
