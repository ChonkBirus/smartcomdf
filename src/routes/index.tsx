import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
        SmartPro
      </h1>
      <p className="text-lg text-muted-foreground max-w-2xl mb-8">
        Sistema de Gestão para Prestadores de Serviços e Comércio. 
        Otimize seus orçamentos, projetos e financeiro em um só lugar.
      </p>
      <div className="flex gap-4">
        <Button asChild size="lg">
          <Link to="/quotes">Ver Orçamentos</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/projects">Projetos</Link>
        </Button>
      </div>
      
      {/* 
      Audit: corrigir o  erro Error: column items.image_path does not exist
      {
        "timestamp": 1787319432512,
        "error_type": "RUNTIME_ERROR",
        "filename": "https://localhost:8080/_serverFn/eyJmaWxlIjoiL3NyYy9saWIvcXVvdGVzLmZ1bmN0aW9ucy50cz90c3Mtc2VydmVyZm4tc3BsaXQiLCJleHBvcnQiOiJsaXN0UXVvdGVDYXRhbG9nX2NyZWF0ZVNlcnZlckZuX2hhbmRsZXIifQ",
        "lineno": 0,
        "colno": 0,
        "stack": "Error: column items.image_path does not exist\n    at Object.eval (/dev-server/src/lib/quotes.functions.ts:179:22)\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at async server (/dev-server/node_modules/@tanstack/start-client-core/src/createServerFn.ts:803:24)\n    at async callNextMiddleware (/dev-server/node_modules/@tanstack/start-client-core/src/createServerFn.ts:288:24)\n    at async userNext (/dev-server/node_modules/@tanstack/start-client-core/src/createServerFn.ts:278:26)\n    at async callNextMiddleware (/dev-server/node_modules/@tanstack/start-client-core/src/createServerFn.ts:288:24)\n    at async AsyncFunction.__executeServer (/dev-server/node_modules/@tanstack/start-client-core/src/createServerFn.ts:170:28)\n    at async eval (/dev-server/node_modules/@tanstack/start-server-core/src/server-functions-handler.ts:148:18)\n    at async eval (/dev-server/node_modules/@tanstack/start-server-core/src/server-functions-handler.ts:81:17)\n    at async handleServerAction (/dev-server/node_modules/@tanstack/start-server-core/src/server-functions-handler.ts:79:20)",
        "has_blank_screen": true
      }
      */}
    </div>
  ),
});