import { useState, useEffect } from 'react'
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import './App.css'

interface S3Object {
  Key?: string
  Size?: number
  LastModified?: Date
}

interface FileSection {
  prefix: string
  displayName: string
  files: S3Object[]
}

// Function to sort files into sections based on prefix
function sortFilesIntoSections(files: S3Object[]): FileSection[] {
  const sections: Record<string, S3Object[]> = {}
  const unsorted: S3Object[] = []
  
  files.forEach(file => {
    if (!file.Key) return
    
    // Look for pattern like "en-", "es-", "fr-", etc.
    const match = file.Key.match(/^([a-z]{2})-/)
    
    if (match) {
      const prefix = match[1]
      if (!sections[prefix]) {
        sections[prefix] = []
      }
      sections[prefix].push(file)
    } else {
      unsorted.push(file)
    }
  })
  
  // Convert to FileSection array and sort
  const fileSections: FileSection[] = []
  
  // Add language sections (sorted alphabetically)
  Object.keys(sections)
    .sort()
    .forEach(prefix => {
      fileSections.push({
        prefix,
        displayName: prefix.toUpperCase(),
        files: sections[prefix].sort((a, b) => (a.Key || '').localeCompare(b.Key || ''))
      })
    })
  
  // Add unsorted section if there are files
  if (unsorted.length > 0) {
    fileSections.push({
      prefix: 'unsorted',
      displayName: 'Unsorted',
      files: unsorted.sort((a, b) => (a.Key || '').localeCompare(b.Key || ''))
    })
  }
  
  return fileSections
}

function App() {
  const [files, setFiles] = useState<S3Object[]>([])
  const [fileSections, setFileSections] = useState<FileSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [s3Client, setS3Client] = useState<S3Client | null>(null)
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set())
  const [downloadProgress, setDownloadProgress] = useState<Map<string, number>>(new Map())

  // Initialize S3 client
  useEffect(() => {
    const accessKey = import.meta.env.VITE_EXOSCALE_ACCESS_KEY
    const secretKey = import.meta.env.VITE_EXOSCALE_SECRET_KEY
    const region = import.meta.env.VITE_EXOSCALE_REGION
    const endpoint = import.meta.env.VITE_EXOSCALE_ENDPOINT

console.log('🔧 Initializing S3 client...')

    if (!accessKey || !secretKey) {
      console.error('❌ Missing credentials!')
      setError('Please configure your Exoscale credentials in .env file')
      setLoading(false)
      return
    }

    const client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    })

    console.log('✅ S3 client initialized successfully')
    setS3Client(client)
  }, [])

  // Load files from bucket
  useEffect(() => {
    if (!s3Client) return

    const loadFiles = async () => {
      try {
        setLoading(true)
        const bucketName = import.meta.env.VITE_EXOSCALE_BUCKET_NAME
        
        console.log(`📂 Attempting to list objects in bucket: ${bucketName}`)
        
        const command = new ListObjectsV2Command({
          Bucket: bucketName,
        })

        console.log('🚀 Sending ListObjectsV2 command to Exoscale...')
        const response = await s3Client.send(command)
        
        console.log('✅ API call successful!')
        console.log('📊 Response details:')
        console.log('- KeyCount:', response.KeyCount)
        console.log('- IsTruncated:', response.IsTruncated)
        console.log('- Contents length:', response.Contents?.length || 0)
        
        if (response.Contents && response.Contents.length > 0) {
          console.log('📄 First few files:')
          response.Contents.slice(0, 3).forEach((file, index) => {
            console.log(`  ${index + 1}. ${file.Key} (${file.Size} bytes)`)
          })
        }
        
        const allFiles = response.Contents || []
        setFiles(allFiles)
        
        // Sort files into sections based on prefix
        console.log('📋 Sorting files into sections...')
        const sections = sortFilesIntoSections(allFiles)
        setFileSections(sections)
        
        console.log('📊 File sections:')
        sections.forEach(section => {
          console.log(`- ${section.displayName}: ${section.files.length} files`)
        })
      } catch (err) {
        console.error('❌ API call failed!')
        console.error('Full error object:', err)
        
        // Log specific error properties
        if (err && typeof err === 'object') {
          const error = err as any
          console.error('Error details:')
          console.error('- name:', error.name)
          console.error('- message:', error.message)
          console.error('- code:', error.Code || error.code)
          console.error('- statusCode:', error.$metadata?.httpStatusCode)
          console.error('- requestId:', error.$metadata?.requestId)
          console.error('- fault:', error.$fault)
          
          if (error.$response) {
            console.error('- response body:', error.$response.body)
          }
        }
        let errorMessage = 'Unknown error'
        if (err instanceof Error) {
          if (err.message.includes('AccessDenied') || err.message.includes('not authorized')) {
            errorMessage = `Access denied: Your API key doesn't have permission to list objects in this bucket. Please check your Exoscale IAM permissions or try different credentials.`
          } else if (err.message.includes('InvalidAccessKeyId')) {
            errorMessage = `Invalid access key: Please check your VITE_EXOSCALE_ACCESS_KEY in the .env file.`
          } else if (err.message.includes('SignatureDoesNotMatch')) {
            errorMessage = `Invalid secret key: Please check your VITE_EXOSCALE_SECRET_KEY in the .env file.`
          } else if (err.message.includes('NoSuchBucket')) {
            errorMessage = `Bucket not found: The bucket '${import.meta.env.VITE_EXOSCALE_BUCKET_NAME}' doesn't exist or isn't accessible.`
          } else {
            errorMessage = err.message
          }
        }
        setError(`Failed to load files: ${errorMessage}`)
      } finally {
        setLoading(false)
      }
    }

    loadFiles()
  }, [s3Client])

  const generateDownloadUrl = async (key: string) => {
    if (!s3Client) return '#'
    
    try {
      const bucketName = import.meta.env.VITE_EXOSCALE_BUCKET_NAME
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
      
      // Generate a signed URL valid for 1 hour
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
      return signedUrl
    } catch (err) {
      console.error('Error generating download URL:', err)
      return '#'
    }
  }

  const handleDownload = async (key: string) => {
    if (downloadingFiles.has(key)) {
      console.log('Download already in progress for:', key)
      return
    }
    
    try {
      console.log(`🔽 Starting download for: ${key}`)
      
      // Add to downloading set and initialize progress
      setDownloadingFiles(prev => new Set([...prev, key]))
      setDownloadProgress(prev => new Map([...prev, [key, 0]]))
      
      const url = await generateDownloadUrl(key)
      if (url === '#') {
        console.error('Failed to generate download URL')
        return
      }

      console.log('📋 Generated signed URL, initiating download...')
      
      // Fetch with progress tracking
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`)
      }
      
      const contentLength = response.headers.get('content-length')
      const total = contentLength ? parseInt(contentLength, 10) : 0
      
      if (response.body && total > 0) {
        // Stream with progress tracking
        const reader = response.body.getReader()
        const chunks: Uint8Array[] = []
        let loaded = 0
        
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) break
          
          chunks.push(value)
          loaded += value.length
          
          // Update progress
          const progress = Math.round((loaded / total) * 100)
          setDownloadProgress(prev => new Map([...prev, [key, progress]]))
        }
        
        // Create blob from chunks
        const blob = new Blob(chunks)
        
        // Create object URL for the blob
        const blobUrl = window.URL.createObjectURL(blob)
        
        // Create download link
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = key // Use the original filename
        
        // Add to document, click, and cleanup
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Clean up the object URL
        window.URL.revokeObjectURL(blobUrl)
      } else {
        // Fallback for when we can't track progress
        const blob = await response.blob()
        const blobUrl = window.URL.createObjectURL(blob)
        
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = key
        
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        window.URL.revokeObjectURL(blobUrl)
      }
      
      console.log(`✅ Download completed for: ${key}`)
    } catch (error) {
      console.error('❌ Download failed:', error)
      alert(`Download failed for ${key}. Please try again.`)
    } finally {
      // Remove from downloading set and clear progress
      setDownloadingFiles(prev => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
      setDownloadProgress(prev => {
        const newMap = new Map(prev)
        newMap.delete(key)
        return newMap
      })
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  const formatDate = (date?: Date) => {
    if (!date) return 'Unknown'
    return new Date(date).toLocaleString()
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
          <p>Please make sure you have configured your Exoscale credentials in the .env file:</p>
          <ul>
            <li>VITE_EXOSCALE_ACCESS_KEY</li>
            <li>VITE_EXOSCALE_SECRET_KEY</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <h1>Yoga Veeras Files</h1>
        <p>Bucket: {import.meta.env.VITE_EXOSCALE_BUCKET_NAME}</p>
        <p>Found {files.length} files</p>
      </header>

      <div className="file-sections">
        {files.length === 0 ? (
          <p>No files found in the bucket.</p>
        ) : (
          fileSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="file-section">
              <div className="section-header">
                <h2>{section.displayName}</h2>
                <span className="file-count">({section.files.length} files)</span>
              </div>
              
              <table className="section-table">
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Size</th>
                    <th>Last Modified</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {section.files.map((file, fileIndex) => (
                    <tr key={fileIndex}>
                      <td className="file-name">{file.Key}</td>
                      <td>{formatFileSize(file.Size)}</td>
                      <td>{formatDate(file.LastModified)}</td>
                      <td>
                        <div className="download-container">
                          <button 
                            onClick={() => file.Key && handleDownload(file.Key)}
                            disabled={downloadingFiles.has(file.Key || '')}
                            className={`download-btn ${downloadingFiles.has(file.Key || '') ? 'downloading' : ''}`}
                          >
                            {downloadingFiles.has(file.Key || '') 
                              ? `${downloadProgress.get(file.Key || '') || 0}%`
                              : 'Download'
                            }
                          </button>
                          {downloadingFiles.has(file.Key || '') && (
                            <div className="progress-bar">
                              <div 
                                className="progress-fill" 
                                style={{ width: `${downloadProgress.get(file.Key || '') || 0}%` }}
                              ></div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default App
