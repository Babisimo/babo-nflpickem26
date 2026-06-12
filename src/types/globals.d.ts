declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

// next-auth v5 beta (next-auth@5.0.0-beta.x) does not support stable module augmentation:
// augmenting 'next-auth' with interface Session/User/JWT breaks NextAuth()'s call signature
// because the package's default export is a plain function declaration and TypeScript cannot
// merge interface declarations into a function-export module namespace.
//
// Resolution: consumer files use the AppSession type below for typed session access.
// The jwt/session callbacks in src/lib/auth.ts use explicit `any` parameter annotations
// (: any) to suppress parameter-type errors — this is intentional and isolated to one file.
