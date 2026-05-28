$ports = 8001, 5174

foreach ($port in $ports) {
  Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object {
      try {
        Stop-Process -Id $_ -Force
        Write-Host "Stopped process $_ on port $port"
      } catch {
        Write-Host "Could not stop process $_ on port $port"
      }
    }
}
