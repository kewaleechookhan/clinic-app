# serve.ps1 - Native PowerShell Static File Web Server for Clinic App
$port = 8000
$rootFolder = "C:\Users\kewal\.gemini\antigravity\scratch\clinic-app"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try {
    $listener.Start()
    Write-Host "Server successfully started on http://localhost:$port"
} catch {
    Write-Error "Failed to start server on port $port. Maybe it's already in use?"
    Exit
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/" -or $urlPath -eq "") {
            $urlPath = "/index.html"
        }

        # Match path safely
        $cleanPath = $urlPath.Replace("/", "\").TrimStart("\")
        $filePath = Join-Path $rootFolder $cleanPath

        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            # Content-Type mapping
            if ($filePath -like "*.html") { $response.ContentType = "text/html; charset=utf-8" }
            elseif ($filePath -like "*.css") { $response.ContentType = "text/css; charset=utf-8" }
            elseif ($filePath -like "*.js") { $response.ContentType = "application/javascript; charset=utf-8" }
            elseif ($filePath -like "*.png") { $response.ContentType = "image/png" }
            elseif ($filePath -like "*.jpg" -or $filePath -like "*.jpeg") { $response.ContentType = "image/jpeg" }
            elseif ($filePath -like "*.svg") { $response.ContentType = "image/svg+xml; charset=utf-8" }

            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errorBytes = [System.Text.Encoding]::UTF8.GetBytes("404 - File Not Found")
            $response.ContentLength64 = $errorBytes.Length
            $response.OutputStream.Write($errorBytes, 0, $errorBytes.Length)
        }
    } catch {
        # Handle exceptions gracefully to keep server listening
        Write-Warning $_.Exception.Message
    } finally {
        if ($response) {
            $response.Close()
        }
    }
}
