import { useState, useEffect } from 'react'
import './App.css'

interface FileInfo {
  name: string
  size?: number
  lastModified?: string
  url: string
}

// Note: COMMON_EXTENSIONS could be used for future auto-discovery features

function AppAuto() {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customFileName, setCustomFileName] = useState('')
  const [discoveredFiles, setDiscoveredFiles] = useState<Set<string>>(new Set())

  const bucketUrl = `${import.meta.env.VITE_EXOSCALE_ENDPOINT}/${import.meta.env.VITE_EXOSCALE_BUCKET_NAME}`

  // Load initial known files and attempt auto-discovery
  useEffect(() => {
    const initialFiles = [
      'cr-intro-to-sadhguru.mp4'  // We know this one exists
    ]
    
    loadFiles(initialFiles)
  }, [])

  const loadFiles = async (fileNames: string[]) => {
    setLoading(true)
    setError(null)

    try {
      const filesWithInfo = await Promise.all(
        fileNames.map(async (fileName) => {
          const url = `${bucketUrl}/${fileName}`
          try {
            // Test if file exists and get metadata
            const response = await fetch(url, { method: 'HEAD' })
            if (response.ok) {
              setDiscoveredFiles(prev => new Set([...prev, fileName]))
              return {
                name: fileName,
                url,
                size: parseInt(response.headers.get('content-length') || '0'),
                lastModified: response.headers.get('last-modified') || undefined
              }
            } else {
              return null // File doesn't exist
            }
          } catch (err) {
            console.warn(`Error checking file ${fileName}:`, err)
            return null
          }
        })
      )
      
      const validFiles = filesWithInfo.filter((file) => file !== null) as FileInfo[]
      setFiles(validFiles)
      
    } catch (err) {
      setError(`Failed to load file information: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const addCustomFile = () => {
    if (!customFileName.trim()) return
    
    const fileName = customFileName.trim()
    if (discoveredFiles.has(fileName)) {
      alert('File already in the list!')
      return
    }

    // Add to current files and test it
    loadFiles([...Array.from(discoveredFiles), fileName])
    setCustomFileName('')
  }

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

  const removeFile = (fileName: string) => {
    setDiscoveredFiles(prev => {
      const newSet = new Set(prev)
      newSet.delete(fileName)
      return newSet
    })
    setFiles(prev => prev.filter(f => f.name !== fileName))
  }

  if (loading && files.length === 0) {
    return (
      <div className="app">
        <h1>Exoscale File Access</h1>
        <div className="loading">Loading files...</div>
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
          <p>📋 <strong>Note:</strong> Since we can't automatically list all files in your bucket due to permissions, you need to add files manually by name.</p>
        </div>
      </header>

      {/* File Management Section */}
      <div className="file-management">
        <h3>Add Files</h3>
        <p>Enter the exact filename of a file in your bucket:</p>
        <div className="add-file-form">
          <input
            type="text"
            value={customFileName}
            onChange={(e) => setCustomFileName(e.target.value)}
            placeholder="e.g., my-video.mp4, document.pdf"
            className="file-input"
            onKeyPress={(e) => e.key === 'Enter' && addCustomFile()}
          />
          <button 
            onClick={addCustomFile}
            className="add-btn"
            disabled={!customFileName.trim()}
          >
            Add File
          </button>
        </div>
        
        <div className="file-examples">
          <p><strong>Common file patterns to try:</strong></p>
          <div className="example-files">
            {['video.mp4', 'audio.mp3', 'document.pdf', 'image.jpg', 'presentation.pptx'].map(example => (
              <button 
                key={example}
                onClick={() => setCustomFileName(example)}
                className="example-btn"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="error">
          <p>Error: {error}</p>
        </div>
      )}

      <div className="file-list">
        {files.length === 0 ? (
          <div className="no-files">
            <p>No files loaded yet.</p>
            <p>Add file names above to access them.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>File Name</th>
                <th>Size</th>
                <th>Last Modified</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file, index) => (
                <tr key={index}>
                  <td className="file-name">{file.name}</td>
                  <td>{formatFileSize(file.size)}</td>
                  <td>{formatDate(file.lastModified)}</td>
                  <td className="actions">
                    <button 
                      onClick={() => handleDownload(file)}
                      className="download-btn"
                    >
                      Download
                    </button>
                    <button 
                      onClick={() => removeFile(file.name)}
                      className="remove-btn"
                      title="Remove from list"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="instructions">
        <h3>How to Find Your Files</h3>
        <ol>
          <li><strong>Check your Exoscale console</strong> - Go to Simple Object Storage and browse your bucket</li>
          <li><strong>Use file patterns</strong> - Try common names like "video.mp4", "audio.mp3", etc.</li>
          <li><strong>Test direct URLs</strong> - Try accessing: <code>https://sos-ch-dk-2.exo.io/isha2/FILENAME</code></li>
          <li><strong>Add working files</strong> - Use the input above to add files that exist</li>
        </ol>
        
        <div className="url-template">
          <p><strong>URL Pattern:</strong></p>
          <code>{bucketUrl}/YOUR_FILENAME</code>
        </div>
      </div>
    </div>
  )
}

export default AppAuto
