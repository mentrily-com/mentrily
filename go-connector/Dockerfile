# Cross-compile natively for the target arch (no QEMU emulation during go build).
FROM --platform=$BUILDPLATFORM golang:1.26 AS build
ARG TARGETOS TARGETARCH
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o /connector ./cmd/connector

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /connector /connector
EXPOSE 4300
ENTRYPOINT ["/connector"]
