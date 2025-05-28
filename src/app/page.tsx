'use client';

import { ChatInterface } from '@/components/ChatInterface';
import { WorkflowChatInterface } from '@/components/WorkflowChatInterface';
import { Toaster } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Multi-Agentic RAG System</h1>
      <p className="text-gray-500 mb-4 text-center">
        A multi-agent system for enhanced retrieval augmented generation
      </p>
      
      <div className="flex justify-center space-x-4 mb-8">
        <Link href="/search" className="text-blue-500 hover:underline">
          Search Knowledge Base
        </Link>
      </div>
      
      <Tabs defaultValue="chat" className="w-full mb-8">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chat">Chat Interface</TabsTrigger>
          <TabsTrigger value="workflow">Agent Workflow</TabsTrigger>
        </TabsList>
        
        <TabsContent value="chat" className="mt-4">
          <div className="bg-card p-4 rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4">Chat with AI</h2>
            <p className="text-muted-foreground mb-6">
              Use the standard chat interface to interact with the AI assistant.
            </p>
            <ChatInterface />
          </div>
        </TabsContent>
        
        <TabsContent value="workflow" className="mt-4">
          <div className="bg-card p-4 rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4">Agent Workflow</h2>
            <p className="text-muted-foreground mb-6">
              Interact with the LangGraph workflow agent that can use tools to find information.
            </p>
            <WorkflowChatInterface />
          </div>
        </TabsContent>
      </Tabs>
      
      <Toaster />
    </main>
  );
}
