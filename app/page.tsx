'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, FileText, Briefcase, GraduationCap, Loader2, Copy, Check, Download } from 'lucide-react'

interface BackgroundInfo {
  education: string
  experience: string
  skills: string
  achievements: string
}

export default function Home() {
  const [step, setStep] = useState(1)
  const [jobDescription, setJobDescription] = useState('')
  const [background, setBackground] = useState<BackgroundInfo>({
    education: '',
    experience: '',
    skills: '',
    achievements: ''
  })
  const [generatedResume, setGeneratedResume] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, background })
      })
      const data = await response.json()
      setGeneratedResume(data.resume)
      setStep(3)
    } catch (error) {
      console.error('Error generating resume:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(generatedResume)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadResume = () => {
    const blob = new Blob([generatedResume], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'optimized-resume.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-8 h-8 text-amber-400" />
            <h1 className="text-3xl md:text-4xl font-bold text-white">Resume Optimizer</h1>
          </div>
          <p className="text-slate-400 text-sm md:text-base">
            Transform your background into an irresistible resume
          </p>
        </motion.div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  step >= s
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-slate-700 text-slate-400'
                }`}>
                  {s}
                </div>
                {s < 3 && (
                  <div className={`w-8 h-0.5 ${step > s ? 'bg-amber-500' : 'bg-slate-700'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Job Description */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase className="w-5 h-5 text-amber-400" />
                  <h2 className="text-xl font-semibold text-white">Target Job</h2>
                </div>
                <p className="text-slate-400 text-sm mb-4">
                  Paste the job description you're applying for. We'll extract the key requirements and keywords.
                </p>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  className="w-full h-64 bg-slate-900/50 border border-slate-600 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                />
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!jobDescription.trim()}
                className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                Continue
                <FileText className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* Step 2: Background Info */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                  <GraduationCap className="w-5 h-5 text-amber-400" />
                  <h2 className="text-xl font-semibold text-white">Your Background</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Education
                    </label>
                    <textarea
                      value={background.education}
                      onChange={(e) => setBackground({...background, education: e.target.value})}
                      placeholder="Degrees, certifications, courses, relevant training..."
                      className="w-full h-24 bg-slate-900/50 border border-slate-600 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Work Experience
                    </label>
                    <textarea
                      value={background.experience}
                      onChange={(e) => setBackground({...background, experience: e.target.value})}
                      placeholder="Previous roles, responsibilities, companies, duration..."
                      className="w-full h-32 bg-slate-900/50 border border-slate-600 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Skills & Tools
                    </label>
                    <textarea
                      value={background.skills}
                      onChange={(e) => setBackground({...background, skills: e.target.value})}
                      placeholder="Technical skills, soft skills, tools, languages..."
                      className="w-full h-24 bg-slate-900/50 border border-slate-600 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Key Achievements
                    </label>
                    <textarea
                      value={background.achievements}
                      onChange={(e) => setBackground({...background, achievements: e.target.value})}
                      placeholder="Metrics, awards, projects, impact you've made..."
                      className="w-full h-24 bg-slate-900/50 border border-slate-600 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || (!background.education && !background.experience)}
                  className="flex-[2] py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Optimizing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Resume
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Generated Resume */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-400" />
                    <h2 className="text-xl font-semibold text-white">Your Optimized Resume</h2>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={copyToClipboard}
                      className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                    </button>
                    <button
                      onClick={downloadResume}
                      className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all"
                    >
                      <Download className="w-4 h-4 text-slate-300" />
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-6 text-slate-800 whitespace-pre-wrap font-mono text-sm leading-relaxed max-h-[60vh] overflow-y-auto">
                  {generatedResume}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all"
                >
                  Edit Background
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex-1 py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Regenerate
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center"
        >
          <p className="text-slate-500 text-xs">
            Tip: Include quantifiable achievements like "increased sales by 40%" for maximum impact
          </p>
        </motion.div>
      </div>
    </main>
  )
}
