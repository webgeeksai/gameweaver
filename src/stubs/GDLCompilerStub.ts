// Stub implementation for GDL Compiler
export class GDLCompiler {
    async compile(gdlCode: string): Promise<any> {
        console.log('Compiling GDL code:', gdlCode);
        
        // For now, return a simple compiled result
        return {
            success: true,
            code: gdlCode,
            entities: [],
            scenes: []
        };
    }
}