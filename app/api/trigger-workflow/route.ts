// API route for integrating with n8n workflows
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { year, quarter, month, filePath, fileType } = body

    // Prepare data for n8n workflow
    const workflowData = {
      year,
      quarter,
      month,
      filePath,
      fileType,
      triggeredAt: new Date().toISOString(),
      source: 'gstr2b-app'
    }

    // Send to n8n webhook
    const n8nResponse = await fetch('http://localhost:5678/webhook/gstr2b-trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflowData)
    })

    if (!n8nResponse.ok) {
      throw new Error(`n8n workflow failed: ${n8nResponse.statusText}`)
    }

    const result = await n8nResponse.json()

    return Response.json({
      success: true,
      message: 'GSTR2B workflow triggered successfully',
      workflowResult: result,
      triggeredAt: workflowData.triggeredAt
    })

  } catch (error) {
    console.error('n8n workflow trigger error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return Response.json({
      success: false,
      error: errorMessage,
      message: 'Failed to trigger GSTR2B workflow'
    }, { status: 500 })
  }
}
