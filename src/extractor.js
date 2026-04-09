import { readFileSync } from "fs";
import { parse as parseTSESLint } from "@typescript-eslint/parser";

/**
 * Parse a source file and extract every function (declaration,
 * expression, arrow) with its name, source code, and location.
 */
export function extractFunctions(filepath) {
  let source;
  try {
    source = readFileSync(filepath, "utf8");
  } catch {
    return [];
  }

  let ast;
  const isJSX = filepath.endsWith(".jsx") || filepath.endsWith(".tsx");
  try {
    ast = parseTSESLint(source, {
      range: true,
      loc: true,
      tokens: false,
      jsx: isJSX,
      errorOnUnknownASTType: false,
      filepath,
    });
  } catch (err) {
    console.error(`Erreur parsing ${filepath}:`, err);
    return [];
  }

  const lines = source.split("\n");
  const functions = [];

  walkAST(ast, null, (node, parent) => {
    if (!isFunctionNode(node)) return;

    const startLine = node.loc.start.line - 1;
    const endLine = node.loc.end.line;
    const numLines = endLine - startLine;

    const name = inferFunctionName(node, parent);
    const code = lines.slice(startLine, endLine).join("\n");

    functions.push({
      name,
      code,
      line: node.loc.start.line,
      endLine: node.loc.end.line,
      numLines,
      file: filepath,
      type: node.type,
    });
  });

  return functions;
}

function isFunctionNode(node) {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

/**
 * Walk the AST and call visitor for each node, passing its parent.
 */
function walkAST(node, parent, visitor) {
  if (!node || typeof node !== "object") return;

  visitor(node, parent);

  for (const key of Object.keys(node)) {
    if (key === "parent") continue;
    const child = node[key];
    if (Array.isArray(child)) {
      child.forEach((c) => {
        if (c && typeof c === "object" && c.type) {
          walkAST(c, node, visitor);
        }
      });
    } else if (child && typeof child === "object" && child.type) {
      walkAST(child, node, visitor);
    }
  }
}

/**
 * Try to infer a meaningful name for the function from its context.
 */
function inferFunctionName(node, parent) {
  // Named function declaration: function myFunc() {}
  if (node.id?.name) return node.id.name;

  if (parent) {
    // const myFunc = () => {}  or  const myFunc = function() {}
    if (
      parent.type === "VariableDeclarator" &&
      parent.id?.type === "Identifier"
    ) {
      return parent.id.name;
    }

    // { myMethod() {} }  or  class { myMethod() {} }
    if (
      (parent.type === "Property" || parent.type === "MethodDefinition") &&
      parent.key?.type === "Identifier"
    ) {
      return parent.key.name;
    }

    // module.exports = function() {}
    if (
      parent.type === "AssignmentExpression" &&
      parent.left?.type === "MemberExpression"
    ) {
      const obj = parent.left.object?.name ?? "";
      const prop = parent.left.property?.name ?? "";
      if (obj && prop) return `${obj}.${prop}`;
    }
  }

  if (parent?.type === "CallExpression" && parent.callee.name === "useEffect") {
    return `useEffect callback at line ${node.loc.start.line}`;
  }

  return "(anonymous)";
}
