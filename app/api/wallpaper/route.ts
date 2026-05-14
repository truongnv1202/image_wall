import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BODY = { error: "Wallpaper đã tắt — /wall chỉ dùng lưới ảnh upload." };

/** Wallpaper không còn dùng; giữ route để client cũ nhận lỗi rõ ràng thay vì 404. */
export function GET() {
  return NextResponse.json(BODY, { status: 410 });
}

export function POST() {
  return NextResponse.json(BODY, { status: 410 });
}

export function DELETE() {
  return NextResponse.json(BODY, { status: 410 });
}
