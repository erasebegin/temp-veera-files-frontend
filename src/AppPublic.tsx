import { useState, useEffect } from 'react'
import './App.css'

interface FileInfo {
  name: string
  size?: number
  lastModified?: string
  url: string
}

// Predefined list of files - you can expand this list as needed
const KNOWN_FILES: FileInfo[] = [
  {
    name: 'cr-intro-to-sadhguru.mp4',
    url: 'https://sos-ch-dk-2.exo.io/isha2/cr-intro-to-sadhguru.mp4'
  }
  // Add more files here as needed
]

function AppPublic() {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load file information
  useEffect(() => {
    const loadFileInfo = async () => {
      setLoading(true)
      try {
        const filesWithInfo = await Promise.all(
          KNOWN_FILES.map(async (file) => {
            try {
              // Get file metadata using HEAD request
              const response = await fetch(file.url, { method: 'HEAD' })
              if (response.ok) {
                return {
                  ...file,
                  size: parseInt(response.headers.get('content-length') || '0'),
                  lastModified: response.headers.get('last-modified') || undefined
                }
              } else {
                console.warn(`File not accessible: ${file.name}`)
                return file // Return file anyway, but without metadata
              }
            } catch (err) {
              console.warn(`Error loading metadata for ${file.name}:`, err)
              return file // Return file anyway, but without metadata
            }
          })
        )
        
        setFiles(filesWithInfo)
      } catch (err) {
        setError(`Failed to load file information: ${err instanceof Error ? err.message : 'Unknown error'}`)
      } finally {
        setLoading(false)
      }
    }

    loadFileInfo()
  }, [])

  const handleDownload = (file: FileInfo) => {
    window.open(file.url, '_blank')
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <div className="app">
        <h1>Exoscale File Access</h1>
        <div className="loading">Loading files...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app">
        <h1>Exoscale File Access</h1>
        <div className="error">
          <p>Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <h1>Exoscale File Access</h1>
        <p>Bucket: {import.meta.env.VITE_EXOSCALE_BUCKET_NAME}</p>
        <p>Found {files.length} files</p>
        <div className="info-banner">
          <p>📋 <strong>Note:</strong> Using public bucket access mode. Files are accessible without authentication.</p>
        </div>
      </header>

      <div className="file-list">
        {files.length === 0 ? (
          <div className="no-files">
            <p>No files configured.</p>
            <p>To add files, edit the KNOWN_FILES list in the source code.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>File Name</th>
                <th>Size</th>
                <th>Last Modified</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file, index) => (
                <tr key={index}>
                  <td className="file-name">{file.name}</td>
                  <td>{formatFileSize(file.size)}</td>
                  <td>{formatDate(file.lastModified)}</td>
                  <td>
                    <button 
                      onClick={() => handleDownload(file)}
                      className="download-btn"
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default AppPublic
