$ports = @(9099, 8080, 5001, 8081, 4000)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        Write-Host "Killing PID $($conn.OwningProcess) on port $port"
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "All ports cleared"
