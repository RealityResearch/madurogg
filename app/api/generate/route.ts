import { NextResponse } from 'next/server'

interface BackgroundInfo {
  education: string
  experience: string
  skills: string
  achievements: string
}

// Extract key terms from job description
function extractKeywords(jobDescription: string): string[] {
  const commonKeywords = [
    // Technical
    'python', 'javascript', 'typescript', 'react', 'node', 'aws', 'docker', 'kubernetes',
    'sql', 'nosql', 'mongodb', 'postgresql', 'redis', 'graphql', 'rest', 'api',
    'machine learning', 'ai', 'data analysis', 'cloud', 'devops', 'ci/cd', 'agile', 'scrum',
    // Business
    'strategy', 'leadership', 'management', 'communication', 'stakeholder', 'budget',
    'project management', 'cross-functional', 'strategic', 'analytics', 'optimization',
    'revenue', 'growth', 'acquisition', 'retention', 'kpi', 'metrics', 'roi',
    // Action words recruiters love
    'led', 'managed', 'developed', 'implemented', 'designed', 'created', 'built',
    'optimized', 'increased', 'reduced', 'delivered', 'launched', 'scaled', 'drove',
    'collaborated', 'mentored', 'established', 'streamlined', 'automated', 'transformed'
  ]

  const lowerDesc = jobDescription.toLowerCase()
  const found = commonKeywords.filter(kw => lowerDesc.includes(kw.toLowerCase()))

  // Also extract capitalized terms that might be important
  const capitalizedTerms = jobDescription.match(/[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*/g) || []

  return [...new Set([...found, ...capitalizedTerms.slice(0, 10)])]
}

// Parse experience into structured format
function parseExperience(experience: string): { title: string; company: string; points: string[] }[] {
  if (!experience.trim()) return []

  const lines = experience.split('\n').filter(l => l.trim())
  const roles: { title: string; company: string; points: string[] }[] = []

  let currentRole: { title: string; company: string; points: string[] } | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    // Check if this looks like a role/company line
    if (trimmed.includes(' at ') || trimmed.includes(' - ') || /^\d{4}/.test(trimmed) || /[A-Z]/.test(trimmed[0]) && !trimmed.startsWith('-')) {
      if (currentRole) roles.push(currentRole)
      currentRole = { title: trimmed.split(/\s+at\s+|\s+-\s+/)[0], company: trimmed.split(/\s+at\s+|\s+-\s+/)[1] || '', points: [] }
    } else if (currentRole && trimmed) {
      currentRole.points.push(trimmed.replace(/^[-•]\s*/, ''))
    } else if (!currentRole && trimmed) {
      currentRole = { title: trimmed, company: '', points: [] }
    }
  }

  if (currentRole) roles.push(currentRole)
  return roles
}

// Generate action-oriented bullet points
function enhanceBulletPoint(point: string, keywords: string[]): string {
  const actionVerbs = ['Spearheaded', 'Engineered', 'Orchestrated', 'Championed', 'Pioneered', 'Accelerated', 'Architected', 'Cultivated']

  let enhanced = point.trim()

  // If doesn't start with action verb, add one
  const startsWithVerb = /^(Led|Managed|Developed|Built|Created|Implemented|Designed|Drove|Increased|Decreased|Improved|Delivered|Launched|Established|Executed|Coordinated|Spearheaded|Engineered|Orchestrated)/i.test(enhanced)

  if (!startsWithVerb) {
    const verb = actionVerbs[Math.floor(Math.random() * actionVerbs.length)]
    enhanced = `${verb} ${enhanced.charAt(0).toLowerCase()}${enhanced.slice(1)}`
  }

  // Ensure ends with period
  if (!enhanced.endsWith('.')) enhanced += '.'

  return enhanced
}

// Generate optimized resume
function generateResume(jobDescription: string, background: BackgroundInfo): string {
  const keywords = extractKeywords(jobDescription)
  const experiences = parseExperience(background.experience)

  const educationLines = background.education.split('\n').filter(l => l.trim())
  const skillsList = background.skills.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
  const achievementsList = background.achievements.split('\n').filter(l => l.trim())

  // Build professional summary using keywords
  const relevantKeywords = keywords.slice(0, 5).join(', ')
  const yearsMatch = background.experience.match(/(\d+)\s*\+?\s*years?/i)
  const years = yearsMatch ? yearsMatch[1] : '5+'

  let resume = `PROFESSIONAL SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Results-driven professional with ${years} years of experience delivering measurable impact across ${relevantKeywords || 'key business areas'}. Proven track record of driving operational excellence and achieving strategic objectives. Adept at translating complex challenges into actionable solutions that generate tangible business value.

`

  // Experience section
  if (experiences.length > 0 || background.experience.trim()) {
    resume += `PROFESSIONAL EXPERIENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
    if (experiences.length > 0) {
      for (const exp of experiences) {
        resume += `\n${exp.title.toUpperCase()}${exp.company ? ` | ${exp.company}` : ''}\n`
        if (exp.points.length > 0) {
          for (const point of exp.points) {
            resume += `• ${enhanceBulletPoint(point, keywords)}\n`
          }
        }
      }
    } else {
      // Fallback: use raw experience text but enhance it
      const expLines = background.experience.split('\n').filter(l => l.trim())
      for (const line of expLines) {
        resume += `• ${enhanceBulletPoint(line, keywords)}\n`
      }
    }
    resume += '\n'
  }

  // Key Achievements section
  if (achievementsList.length > 0) {
    resume += `KEY ACHIEVEMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
    for (const achievement of achievementsList) {
      resume += `★ ${achievement.replace(/^[-•★]\s*/, '').trim()}\n`
    }
    resume += '\n'
  }

  // Skills section - organized and keyword-optimized
  if (skillsList.length > 0) {
    resume += `CORE COMPETENCIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
    // Prioritize skills that match job description
    const prioritizedSkills = [
      ...skillsList.filter(s => keywords.some(k => s.toLowerCase().includes(k.toLowerCase()))),
      ...skillsList.filter(s => !keywords.some(k => s.toLowerCase().includes(k.toLowerCase())))
    ]

    // Format in columns (3 per row for readability)
    const rows = []
    for (let i = 0; i < prioritizedSkills.length; i += 3) {
      rows.push(prioritizedSkills.slice(i, i + 3).join('  •  '))
    }
    resume += rows.join('\n') + '\n\n'
  }

  // Education section
  if (educationLines.length > 0) {
    resume += `EDUCATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
    for (const edu of educationLines) {
      resume += `${edu.trim()}\n`
    }
    resume += '\n'
  }

  // Add ATS-friendly keyword section at bottom
  const matchedKeywords = keywords.filter(k =>
    (background.skills + background.experience + background.education).toLowerCase().includes(k.toLowerCase())
  )

  if (matchedKeywords.length > 0) {
    resume += `ADDITIONAL KEYWORDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${matchedKeywords.join(' • ')}
`
  }

  return resume.trim()
}

export async function POST(request: Request) {
  try {
    const { jobDescription, background } = await request.json()

    if (!jobDescription || !background) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Simulate processing time for better UX
    await new Promise(resolve => setTimeout(resolve, 1500))

    const resume = generateResume(jobDescription, background)

    return NextResponse.json({ resume })
  } catch (error) {
    console.error('Error generating resume:', error)
    return NextResponse.json(
      { error: 'Failed to generate resume' },
      { status: 500 }
    )
  }
}
